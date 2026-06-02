import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { buildCustomerAppContext } from "../lib/customerAppContextService.js";
import {
  appendMenuLastOrdered,
  bumpMenuBrowseEngagement,
  mergeRestaurantMenuPrefs,
  readRestaurantMenuPrefs,
  toggleMenuItemLike,
  type RestaurantMenuPrefs
} from "../lib/customerMenuPreferences.js";
import {
  DEFAULT_CUSTOMER_APP_SETTINGS,
  mergeAppSettingsIntoProfile,
  mergeAvatarIntoProfile,
  mergePreferredRestaurantIntoProfile,
  mergeQuickPrefsIntoProfile,
  readAppSettingsFromProfile,
  readAvatarUriFromProfile,
  readPreferredRestaurantIdFromProfile,
  readQuickPrefsFromProfile,
  type CustomerAppSettings
} from "../lib/customerSignupProfile.js";

function bearerToken(headers: { authorization?: string }): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

function requireCustomer(req: { headers: { authorization?: string } }, app: FastifyInstance) {
  const tok = bearerToken(req.headers as { authorization?: string });
  if (!tok) throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  const pl = app.verifyJwt(tok);
  if (pl.role !== "CUSTOMER") throw Object.assign(new Error("customer_only"), { statusCode: 403 });
  return pl;
}

export function registerCustomerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/customer/restaurant-directory", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, openingHours: true },
      orderBy: { name: "asc" }
    });
    return { ok: true, restaurants };
  });

  /** Central SST snapshot for home, nav badges, cart, booking draft, and control-centre prefs. */
  app.get("/customer/context", async (req, reply) => {
    let user;
    try {
      user = requireCustomer(req, app);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
    }
    const q = req.query as { restaurantId?: string };
    const restaurantId =
      typeof q.restaurantId === "string" && q.restaurantId.trim() ? q.restaurantId.trim() : null;
    const context = await buildCustomerAppContext(prisma, user.sub, restaurantId);
    return { ok: true, context };
  });

  app.patch("/customer/preferred-restaurant", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const parsed = z.object({ restaurantId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation_error" });
    }

    const { restaurantId } = parsed.data;
    const r = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true }
    });
    if (!r) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });

    const u = await prisma.user.findUnique({
      where: { id: pl.sub },
      select: { id: true, signupProfile: true }
    });
    if (!u) return reply.status(404).send({ ok: false, error: "user_not_found" });

    await prisma.user.update({
      where: { id: pl.sub },
      data: { signupProfile: mergePreferredRestaurantIntoProfile(u.signupProfile, r.id) },
      select: { id: true }
    });

    return { ok: true, preferredRestaurantId: r.id, restaurantName: r.name };
  });

  app.get("/customer/preferences", async (req, reply) => {
    let user;
    try {
      user = requireCustomer(req, app);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
    }
    const row = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { signupProfile: true }
    });
    return {
      ok: true,
      appSettings: readAppSettingsFromProfile(row?.signupProfile),
      quickPrefs: readQuickPrefsFromProfile(row?.signupProfile),
      avatarUri: readAvatarUriFromProfile(row?.signupProfile),
      preferredRestaurantId: readPreferredRestaurantIdFromProfile(row?.signupProfile)
    };
  });

  app.patch("/customer/preferences", async (req, reply) => {
    let user;
    try {
      user = requireCustomer(req, app);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
    }

    const body = z
      .object({
        appSettings: z.custom<CustomerAppSettings>().optional(),
        quickPrefs: z
          .object({
            push: z.boolean(),
            location: z.boolean()
          })
          .optional(),
        avatarUri: z.string().nullable().optional()
      })
      .parse(req.body);

    const u = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { signupProfile: true }
    });
    if (!u) return reply.status(404).send({ ok: false, error: "user_not_found" });

    let profile = u.signupProfile;
    if (body.appSettings) {
      profile = mergeAppSettingsIntoProfile(profile, body.appSettings);
    }
    if (body.quickPrefs) {
      profile = mergeQuickPrefsIntoProfile(profile, body.quickPrefs);
    }
    if (body.avatarUri !== undefined) {
      profile = mergeAvatarIntoProfile(profile, body.avatarUri);
    }

    await prisma.user.update({
      where: { id: user.sub },
      data: { signupProfile: profile }
    });

    return {
      ok: true,
      appSettings: readAppSettingsFromProfile(profile),
      quickPrefs: readQuickPrefsFromProfile(profile),
      avatarUri: readAvatarUriFromProfile(profile),
      preferredRestaurantId: readPreferredRestaurantIdFromProfile(profile)
    };
  });

  app.get("/customer/preferences/defaults", async () => ({
    ok: true,
    appSettings: DEFAULT_CUSTOMER_APP_SETTINGS
  }));

  app.get<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/menu-preferences",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const restaurantId = req.params.restaurantId.trim();
      const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
      if (!r) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
      const row = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { signupProfile: true }
      });
      const prefs = readRestaurantMenuPrefs(row?.signupProfile, restaurantId);
      return { ok: true, prefs };
    }
  );

  app.patch<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/menu-preferences",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const restaurantId = req.params.restaurantId.trim();
      const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
      if (!r) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });

      const body = z
        .object({
          action: z.enum(["toggle_like", "bump_engagement", "append_last_ordered", "replace"]),
          menuItemId: z.string().trim().min(1).optional(),
          menuItemIds: z.array(z.string().trim().min(1)).optional(),
          prefs: z
            .object({
              likes: z.array(z.string()),
              lastOrdered: z.array(z.string()),
              browseEngagementScore: z.number().int().min(0).optional()
            })
            .optional()
        })
        .parse(req.body);

      const row = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { signupProfile: true }
      });
      if (!row) return reply.status(404).send({ ok: false, error: "user_not_found" });

      let profileJson: Prisma.InputJsonValue = row.signupProfile as Prisma.InputJsonValue;
      let prefs: RestaurantMenuPrefs;
      let nowLiked: boolean | undefined;

      switch (body.action) {
        case "toggle_like": {
          if (!body.menuItemId) {
            return reply.status(400).send({ ok: false, error: "menu_item_required" });
          }
          const res = toggleMenuItemLike(profileJson, restaurantId, body.menuItemId);
          profileJson = res.profile;
          prefs = res.prefs;
          nowLiked = res.nowLiked;
          break;
        }
        case "bump_engagement": {
          const res = bumpMenuBrowseEngagement(profileJson, restaurantId);
          profileJson = res.profile;
          prefs = res.prefs;
          break;
        }
        case "append_last_ordered": {
          const res = appendMenuLastOrdered(profileJson, restaurantId, body.menuItemIds ?? []);
          profileJson = res.profile;
          prefs = res.prefs;
          break;
        }
        case "replace": {
          if (!body.prefs) {
            return reply.status(400).send({ ok: false, error: "prefs_required" });
          }
          profileJson = mergeRestaurantMenuPrefs(profileJson, restaurantId, body.prefs);
          prefs = readRestaurantMenuPrefs(profileJson, restaurantId);
          break;
        }
        default:
          return reply.status(400).send({ ok: false, error: "invalid_action" });
      }

      await prisma.user.update({
        where: { id: user.sub },
        data: { signupProfile: profileJson }
      });

      return { ok: true, prefs, ...(nowLiked !== undefined ? { nowLiked } : {}) };
    }
  );
}
