import type { PrismaClient } from "@prisma/client";
import { normalizePhone, validatePhone } from "./validation.js";
import { logSecurityActivity } from "./securityActivity.js";
import { captureSecurityAudit } from "../integrations/auditReporter.js";
import { resolveProfileImageUrl, storeProfileImageDirect } from "../integrations/objectStorage.js";

export function readOwnerContactNameFromSignup(signupProfile: unknown): string | null {
  if (!signupProfile || typeof signupProfile !== "object" || Array.isArray(signupProfile)) return null;
  const root = signupProfile as Record<string, unknown>;
  const reg = root.registrationProfile;
  if (reg && typeof reg === "object" && !Array.isArray(reg)) {
    const contact = (reg as { contactPerson?: string }).contactPerson?.trim();
    if (contact) return contact;
    const fullName = (reg as { fullName?: string }).fullName?.trim();
    if (fullName) return fullName;
  }
  return null;
}

export async function getAccountBundle(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      updatedAt: true,
      signupProfile: true,
      accountProfile: true,
      appPreferences: true,
      twoFactorAuth: { select: { enabled: true, lastVerifiedAt: true, enabledAt: true } },
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          role: true,
          restaurant: { select: { id: true, name: true } }
        }
      }
    }
  });
  if (!user) return null;

  const signupName = readOwnerContactNameFromSignup(user.signupProfile);
  const profile = user.accountProfile;

  return {
    userId: user.id,
    email: user.email,
    phone: profile?.phone ?? user.phone,
    role: user.role,
    fullName: profile?.fullName ?? signupName,
    jobTitle: profile?.jobTitle ?? null,
    profileImageUrl: profile?.profileImageKey
      ? await resolveProfileImageUrl(profile.profileImageKey)
      : (profile?.profileImageUrl ?? null),
    profileUpdatedAt: profile?.updatedAt?.toISOString() ?? user.updatedAt.toISOString(),
    preferences: user.appPreferences ?? {
      language: "en",
      timezone: "Europe/Stockholm",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      theme: "system"
    },
    twoFactor: {
      enabled: user.twoFactorAuth?.enabled ?? false,
      lastVerifiedAt: user.twoFactorAuth?.lastVerifiedAt?.toISOString() ?? null,
      enabledAt: user.twoFactorAuth?.enabledAt?.toISOString() ?? null,
      backupCodesGenerated: Boolean(user.twoFactorAuth?.enabled)
    },
    venues: user.memberships.map((m) => ({
      id: m.restaurant.id,
      name: m.restaurant.name,
      role: m.role
    }))
  };
}

export async function patchAccountProfile(
  prisma: PrismaClient,
  userId: string,
  body: { fullName?: string; phone?: string; jobTitle?: string },
  ipMasked?: string | null
) {
  if (body.phone !== undefined && body.phone.trim() && !validatePhone(body.phone)) {
    return { ok: false as const, error: "invalid_phone" };
  }

  const data = {
    ...(body.fullName !== undefined ? { fullName: body.fullName.trim() || null } : {}),
    ...(body.phone !== undefined ? { phone: body.phone.trim() ? normalizePhone(body.phone) : null } : {}),
    ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle.trim() || null } : {})
  };

  const profile = await prisma.userAccountProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data
  });

  if (body.phone !== undefined && body.phone.trim()) {
    await prisma.user.update({
      where: { id: userId },
      data: { phone: normalizePhone(body.phone) },
      select: { id: true }
    });
  }

  await logSecurityActivity(prisma, { userId, type: "PROFILE_UPDATED", ipMasked });
  captureSecurityAudit({ userId, action: "profile_updated" });

  return { ok: true as const, profile };
}

export async function saveProfileImage(
  prisma: PrismaClient,
  userId: string,
  params: { imageKey: string; dataBase64: string; contentType: string },
  ipMasked?: string | null
) {
  if (!params.imageKey.startsWith(`profiles/${userId}/`)) {
    return { ok: false as const, error: "invalid_image_key" };
  }

  const stored = await storeProfileImageDirect(params.imageKey, params.dataBase64, params.contentType);
  if (!stored.ok) return stored;

  await prisma.userAccountProfile.upsert({
    where: { userId },
    create: {
      userId,
      profileImageKey: stored.objectKey,
      profileImageUrl: null
    },
    update: {
      profileImageKey: stored.objectKey,
      profileImageUrl: null
    }
  });

  await prisma.storedMedia.create({
    data: {
      objectKey: stored.objectKey,
      scope: "PROFILE_IMAGE",
      contentType: params.contentType,
      byteSize: stored.byteSize,
      sha256Hex: stored.sha256Hex,
      visibility: "PRIVATE",
      uploadedById: userId,
      userId
    }
  });

  const profileImageUrl = await resolveProfileImageUrl(stored.objectKey);

  await logSecurityActivity(prisma, { userId, type: "PROFILE_UPDATED", ipMasked, metadata: { field: "avatar" } });
  return { ok: true as const, profileImageUrl };
}
