/**
 * Availability manage mutations — backend SSOT for rule updates.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { listVenueHoursPeers } from "../venueHoursPeersService.js";
import {
  appendAvailabilityHistory,
  cloneAvailabilityWindow,
  sanitizeAvailabilityWindow,
  sanitizeAvailabilityWindows,
  type AvailabilityAuditEntry,
  type AvailabilityChannel,
  type AvailabilityScheduleKind,
  type AvailabilityVisibility,
  type AvailabilityWindow,
  type MenuAvailabilityWindows,
  AVAILABILITY_CHANNELS
} from "./menuAvailability.js";
import { evaluateAvailabilityCard } from "./availabilityEvaluationService.js";
import { menuListInclude, serializeMenu } from "./menuService.js";

export type AvailabilityWindowRef = { menuId: string; key: string };

export type AvailabilityManageAction =
  | "make_available"
  | "make_unavailable"
  | "set_recurring"
  | "set_temporary"
  | "set_seasonal"
  | "mark_out_of_stock"
  | "restock"
  | "set_channels"
  | "set_locations_all"
  | "set_locations"
  | "set_visibility"
  | "set_business_rules"
  | "copy_schedule"
  | "copy_availability"
  | "apply_to_menus"
  | "reset_to_default"
  | "remove_rules"
  | "update_window"
  | "export_rules"
  | "import_schedule";

export type AvailabilityManagePayload = {
  action: AvailabilityManageAction;
  refs: AvailabilityWindowRef[];
  /** Partial window patch for update_window / schedule setters */
  patch?: Partial<AvailabilityWindow>;
  targetMenuIds?: string[];
  importWindows?: MenuAvailabilityWindows;
  actorUserId?: string | null;
};

function historyEntry(
  action: string,
  detail?: string,
  actorUserId?: string | null
): Omit<AvailabilityAuditEntry, "at"> {
  return {
    action,
    ...(detail ? { detail } : {}),
    ...(actorUserId !== undefined ? { actorUserId } : {})
  };
}

function makeKey(label: string) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "window";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadMenuWindows(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId },
    select: {
      id: true,
      name: true,
      status: true,
      availabilityWindows: true,
      scheduledPublishAt: true,
      scheduledUnpublishAt: true,
      restaurant: { select: { openingHours: true } }
    }
  });
  if (!menu) return null;
  return {
    ...menu,
    windows: sanitizeAvailabilityWindows(menu.availabilityWindows) ?? {}
  };
}

async function writeWindows(
  prisma: PrismaClient,
  menuId: string,
  windows: MenuAvailabilityWindows
) {
  const payload = Object.keys(windows).length > 0 ? windows : {};
  const updated = await prisma.menu.update({
    where: { id: menuId },
    data: { availabilityWindows: payload as unknown as Prisma.InputJsonValue },
    include: menuListInclude
  });
  return {
    menu: {
      ...serializeMenu(updated),
      scheduledPublishAt: updated.scheduledPublishAt?.toISOString() ?? null,
      scheduledUnpublishAt: updated.scheduledUnpublishAt?.toISOString() ?? null,
      availabilityWindows: sanitizeAvailabilityWindows(updated.availabilityWindows)
    }
  };
}

function applyPatch(window: AvailabilityWindow, patch: Partial<AvailabilityWindow>): AvailabilityWindow {
  const merged = sanitizeAvailabilityWindow({ ...window, ...patch });
  return merged ?? window;
}

export async function listAvailabilityOverview(prisma: PrismaClient, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, openingHours: true }
  });
  if (!restaurant) return { ok: false as const, error: "restaurant_not_found" as const };

  const menus = await prisma.menu.findMany({
    where: { restaurantId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      status: true,
      availabilityWindows: true,
      scheduledPublishAt: true,
      scheduledUnpublishAt: true
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  const peers = await listVenueHoursPeers(prisma, restaurantId);
  const locations =
    peers.ok
      ? [{ id: peers.current.id, name: peers.current.name }, ...peers.peers.map((p) => ({ id: p.id, name: p.name }))]
      : [{ id: restaurant.id, name: restaurant.name }];

  const timezone = "Europe/Stockholm";
  const cards = [];
  for (const menu of menus) {
    const windows = sanitizeAvailabilityWindows(menu.availabilityWindows) ?? {};
    for (const [key, window] of Object.entries(windows)) {
      const evaluation = evaluateAvailabilityCard({
        window,
        windowKey: key,
        menuStatus: menu.status,
        openingHours: restaurant.openingHours,
        timezone,
        scheduledPublishAt: menu.scheduledPublishAt,
        scheduledUnpublishAt: menu.scheduledUnpublishAt,
        locationId: restaurant.id
      });
      cards.push({
        key,
        menuId: menu.id,
        menuName: menu.name,
        menuStatus: menu.status,
        window,
        evaluation
      });
    }
  }

  cards.sort((a, b) => a.window.label.localeCompare(b.window.label));

  return {
    ok: true as const,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      timezone,
      openingHours: restaurant.openingHours
    },
    locations,
    channels: AVAILABILITY_CHANNELS,
    cards
  };
}

export async function applyAvailabilityManageAction(
  prisma: PrismaClient,
  restaurantId: string,
  input: AvailabilityManagePayload
) {
  if (!input.refs.length && input.action !== "import_schedule") {
    return { ok: false as const, error: "no_targets" as const };
  }

  const actor = input.actorUserId ?? null;
  const touchedMenus = new Set<string>();
  let exported: MenuAvailabilityWindows | null = null;
  let affected = 0;

  if (input.action === "import_schedule") {
    const targetMenuId = input.targetMenuIds?.[0] ?? input.refs[0]?.menuId;
    if (!targetMenuId || !input.importWindows) {
      return { ok: false as const, error: "invalid_import" as const };
    }
    const menu = await loadMenuWindows(prisma, restaurantId, targetMenuId);
    if (!menu) return { ok: false as const, error: "menu_not_found" as const };
    const incoming = sanitizeAvailabilityWindows(input.importWindows) ?? {};
    const next = { ...menu.windows };
    for (const [, window] of Object.entries(incoming)) {
      const key = makeKey(window.label);
      next[key] = appendAvailabilityHistory(window, historyEntry("imported", undefined, actor));
      affected += 1;
    }
    await writeWindows(prisma, targetMenuId, next);
    touchedMenus.add(targetMenuId);
    const overview = await listAvailabilityOverview(prisma, restaurantId);
    return { ...overview, affected, exported };
  }

  if (input.action === "export_rules") {
    exported = {};
    for (const ref of input.refs) {
      const menu = await loadMenuWindows(prisma, restaurantId, ref.menuId);
      const window = menu?.windows[ref.key];
      if (!window) continue;
      exported[ref.key] = window;
      affected += 1;
    }
    const overview = await listAvailabilityOverview(prisma, restaurantId);
    return { ...overview, affected, exported };
  }

  /** Group refs by menu for atomic-ish per-menu writes */
  const byMenu = new Map<string, string[]>();
  for (const ref of input.refs) {
    const list = byMenu.get(ref.menuId) ?? [];
    list.push(ref.key);
    byMenu.set(ref.menuId, list);
  }

  for (const [menuId, keys] of byMenu) {
    const menu = await loadMenuWindows(prisma, restaurantId, menuId);
    if (!menu) continue;
    let next: MenuAvailabilityWindows = { ...menu.windows };
    let changed = false;

    for (const key of keys) {
      const current = next[key];
      if (!current && input.action !== "apply_to_menus") continue;

      switch (input.action) {
        case "make_available": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { enabled: true, paused: false }),
            historyEntry("make_available", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "make_unavailable": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { enabled: false }),
            historyEntry("make_unavailable", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_recurring": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, {
              scheduleKind: "RECURRING" as AvailabilityScheduleKind,
              ...(input.patch ?? {})
            }),
            historyEntry("set_recurring", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_temporary": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, {
              scheduleKind: "TEMPORARY",
              temporaryStartAt: input.patch?.temporaryStartAt ?? current.temporaryStartAt ?? new Date().toISOString(),
              temporaryEndAt: input.patch?.temporaryEndAt ?? current.temporaryEndAt ?? null,
              ...(input.patch ?? {})
            }),
            historyEntry("set_temporary", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_seasonal": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, {
              scheduleKind: "SEASONAL",
              seasonalStartMd: input.patch?.seasonalStartMd ?? current.seasonalStartMd ?? "06-01",
              seasonalEndMd: input.patch?.seasonalEndMd ?? current.seasonalEndMd ?? "08-31",
              ...(input.patch ?? {})
            }),
            historyEntry("set_seasonal", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "mark_out_of_stock": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { outOfStock: true }),
            historyEntry("mark_out_of_stock", "Out of stock ≠ unavailable", actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "restock": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { outOfStock: false }),
            historyEntry("restock", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_channels": {
          if (!current) break;
          const channels = (input.patch?.channels ?? current.channels ?? [...AVAILABILITY_CHANNELS]) as AvailabilityChannel[];
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { channels }),
            historyEntry("set_channels", channels.join(", "), actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_locations_all": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { locationMode: "ALL", locationIds: [] }),
            historyEntry("set_locations_all", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_locations": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, {
              locationMode: "SELECTED",
              locationIds: input.patch?.locationIds ?? current.locationIds ?? []
            }),
            historyEntry("set_locations", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_visibility": {
          if (!current) break;
          const visibility = (input.patch?.visibility ?? "CUSTOMERS") as AvailabilityVisibility;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, { visibility }),
            historyEntry("set_visibility", visibility, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "set_business_rules": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, {
              requiresManagerApproval: input.patch?.requiresManagerApproval ?? current.requiresManagerApproval,
              ageRestricted: input.patch?.ageRestricted ?? current.ageRestricted,
              minAge: input.patch?.minAge ?? current.minAge
            }),
            historyEntry("set_business_rules", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "update_window": {
          if (!current || !input.patch) break;
          next[key] = appendAvailabilityHistory(
            applyPatch(current, input.patch),
            historyEntry("update_window", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "copy_schedule":
        case "copy_availability": {
          if (!current) break;
          const copy = cloneAvailabilityWindow(current);
          const newKey = makeKey(copy.label);
          next[newKey] = copy;
          changed = true;
          affected += 1;
          break;
        }
        case "reset_to_default": {
          if (!current) break;
          next[key] = appendAvailabilityHistory(
            {
              enabled: true,
              start: "09:00",
              end: "17:00",
              days: [1, 2, 3, 4, 5],
              label: current.label,
              color: current.color,
              scheduleKind: "RECURRING",
              temporaryStartAt: null,
              temporaryEndAt: null,
              seasonalStartMd: null,
              seasonalEndMd: null,
              channels: [...AVAILABILITY_CHANNELS],
              locationMode: "ALL",
              locationIds: [],
              visibility: "CUSTOMERS",
              outOfStock: false,
              requiresManagerApproval: false,
              ageRestricted: false,
              minAge: null,
              paused: false
            },
            historyEntry("reset_to_default", undefined, actor)
          );
          changed = true;
          affected += 1;
          break;
        }
        case "remove_rules": {
          if (!current) break;
          delete next[key];
          changed = true;
          affected += 1;
          break;
        }
        case "apply_to_menus": {
          if (!current) break;
          for (const targetId of input.targetMenuIds ?? []) {
            if (targetId === menuId) continue;
            const target = await loadMenuWindows(prisma, restaurantId, targetId);
            if (!target) continue;
            const copy = cloneAvailabilityWindow(current, "");
            copy.label = current.label;
            const newKey = makeKey(copy.label);
            const targetNext = {
              ...target.windows,
              [newKey]: appendAvailabilityHistory(copy, historyEntry("applied_from_menu", menu.name, actor))
            };
            await writeWindows(prisma, targetId, targetNext);
            touchedMenus.add(targetId);
            affected += 1;
          }
          break;
        }
        default:
          break;
      }
    }

    if (changed) {
      await writeWindows(prisma, menuId, next);
      touchedMenus.add(menuId);
    }
  }

  const overview = await listAvailabilityOverview(prisma, restaurantId);
  if (!overview.ok) return overview;
  return { ...overview, affected, exported, touchedMenuIds: [...touchedMenus] };
}

export function mapAvailabilityManageError(code: string): string {
  switch (code) {
    case "restaurant_not_found":
      return "Restaurant not found.";
    case "menu_not_found":
      return "Menu not found.";
    case "no_targets":
      return "Select at least one availability window.";
    case "invalid_import":
      return "Import requires a target menu and schedule payload.";
    default:
      return "Could not update availability.";
  }
}
