import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { mergeActiveExperienceIntoProfile } from "./customerSignupProfile.js";

export function normalizeOrgNumber(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  if (digits.length > 0) return digits;
  return raw.trim().toLowerCase();
}

/** Business wizard payload required to provision Company + Restaurant + OWNER membership. */
export const businessProvisionSchema = z
  .object({
    flow: z.literal("BUSINESS"),
    orgNumber: z.string().min(1),
    companyName: z.string().min(1),
    venueTradingName: z.string().min(2),
    businessType: z.enum(["Restaurant", "Cafe", "Bakery", "Other"]),
    businessTypeOtherDescription: z.string().optional(),
    establishmentLocation: z.string().min(2),
    offeringsDescription: z.string().min(2)
  })
  .superRefine((d, ctx) => {
    if (d.businessType === "Other" && !(d.businessTypeOtherDescription ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessTypeOtherDescription"]
      });
    }
  });

export type BusinessProvisionInput = z.infer<typeof businessProvisionSchema>;

function mergeRegistrationProfile(
  current: unknown,
  patch: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined {
  if (!patch) return undefined;
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? ({ ...(current as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...patch,
    flow: "BUSINESS",
    signupSurface: "web"
  } as Prisma.InputJsonValue;
}

function shouldPromotePlatformRole(currentRole: string): boolean {
  const role = currentRole.trim().toUpperCase();
  return (
    role === "CUSTOMER" ||
    role === "STAFF" ||
    role === "KITCHEN" ||
    role === "CASHIER" ||
    role === "MANAGER"
  );
}

export type ProvisionBusinessWorkspaceResult = {
  restaurantId: string;
  companyId: string;
  membershipId: string;
  platformRole: string;
};

/**
 * Attach a new restaurant workspace + OWNER membership to an existing identity.
 * Never creates a duplicate user — one email/phone = one platform identity.
 */
export async function provisionBusinessWorkspaceForUser(
  prisma: PrismaClient,
  userId: string,
  provision: BusinessProvisionInput,
  options?: { registrationProfile?: Record<string, unknown> }
): Promise<ProvisionBusinessWorkspaceResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, signupProfile: true }
  });
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });

  const orgKey = normalizeOrgNumber(provision.orgNumber);
  const otherDesc =
    provision.businessType === "Other" ? provision.businessTypeOtherDescription!.trim() : null;

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { orgNumberNormalized: orgKey },
      create: { orgNumberNormalized: orgKey, legalName: provision.companyName.trim() },
      update: { legalName: provision.companyName.trim() }
    });

    const restaurant = await tx.restaurant.create({
      data: {
        name: provision.venueTradingName.trim(),
        companyId: company.id,
        venueSubtype: provision.businessType,
        venueSubtypeOther: otherDesc,
        establishmentLocation: provision.establishmentLocation.trim(),
        offeringsDescription: provision.offeringsDescription.trim(),
        accessPolicy: { maxManagers: 3, allowManagersToInviteManagers: false }
      },
      select: { id: true }
    });

    const membership = await tx.membership.upsert({
      where: {
        userId_restaurantId: { userId, restaurantId: restaurant.id }
      },
      create: {
        userId,
        restaurantId: restaurant.id,
        role: "OWNER",
        status: "ACTIVE"
      },
      update: {
        role: "OWNER",
        status: "ACTIVE",
        removedAt: null
      },
      select: { id: true }
    });

    const mergedProfile = mergeRegistrationProfile(user.signupProfile, options?.registrationProfile);
    const withExperience =
      mergedProfile !== undefined
        ? mergeActiveExperienceIntoProfile(mergedProfile, {
            mode: "WORKSPACE",
            restaurantId: restaurant.id
          })
        : mergeActiveExperienceIntoProfile(user.signupProfile, {
            mode: "WORKSPACE",
            restaurantId: restaurant.id
          });

    const nextRole = shouldPromotePlatformRole(user.role) ? "OWNER" : user.role;

    await tx.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        signupProfile: withExperience
      }
    });

    return {
      restaurantId: restaurant.id,
      companyId: company.id,
      membershipId: membership.id,
      platformRole: nextRole
    };
  });
}
