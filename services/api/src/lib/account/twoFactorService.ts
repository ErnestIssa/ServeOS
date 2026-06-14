import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { authenticator } from "otplib";
import bcrypt from "bcrypt";
import { Prisma, type PrismaClient } from "@prisma/client";
import { logSecurityActivity } from "./securityActivity.js";

function encryptionKey(): Buffer {
  const secret = process.env.TWO_FA_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim() || "dev-2fa-key";
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => randomBytes(4).toString("hex").toUpperCase());
}

export async function setupTwoFactor(prisma: PrismaClient, userId: string, email: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email || userId, "ServeOS", secret);

  await prisma.userTwoFactorAuth.upsert({
    where: { userId },
    create: {
      userId,
      secretEnc: encryptSecret(secret),
      enabled: false
    },
    update: {
      secretEnc: encryptSecret(secret),
      enabled: false,
      backupCodesHash: Prisma.JsonNull,
      enabledAt: null
    }
  });

  return { otpauthUrl, secretPreview: `${secret.slice(0, 4)}…${secret.slice(-4)}` };
}

export async function enableTwoFactor(
  prisma: PrismaClient,
  userId: string,
  code: string,
  ipMasked?: string | null
) {
  const row = await prisma.userTwoFactorAuth.findUnique({ where: { userId } });
  if (!row) return { ok: false as const, error: "2fa_not_setup" };

  const secret = decryptSecret(row.secretEnc);
  const valid = authenticator.check(code.replace(/\s/g, ""), secret);
  if (!valid) return { ok: false as const, error: "invalid_2fa_code" };

  const backupCodes = generateBackupCodes();
  const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.userTwoFactorAuth.update({
    where: { userId },
    data: {
      enabled: true,
      enabledAt: new Date(),
      lastVerifiedAt: new Date(),
      backupCodesHash: hashed
    }
  });

  await logSecurityActivity(prisma, { userId, type: "TWO_FA_ENABLED", ipMasked });
  return { ok: true as const, backupCodes };
}

export async function disableTwoFactor(
  prisma: PrismaClient,
  userId: string,
  params: { password: string; code?: string },
  ipMasked?: string | null
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true }
  });
  if (!user) return { ok: false as const, error: "user_not_found" };

  const validPw = await bcrypt.compare(params.password, user.password);
  if (!validPw) return { ok: false as const, error: "invalid_password" };

  const row = await prisma.userTwoFactorAuth.findUnique({ where: { userId } });
  if (row?.enabled && params.code) {
    const secret = decryptSecret(row.secretEnc);
    if (!authenticator.check(params.code.replace(/\s/g, ""), secret)) {
      return { ok: false as const, error: "invalid_2fa_code" };
    }
  }

  await prisma.userTwoFactorAuth.update({
    where: { userId },
    data: { enabled: false, backupCodesHash: Prisma.JsonNull, enabledAt: null }
  });

  await logSecurityActivity(prisma, { userId, type: "TWO_FA_DISABLED", ipMasked });
  return { ok: true as const };
}

export async function verifyTwoFactorTotpCode(
  prisma: PrismaClient,
  userId: string,
  code: string
): Promise<boolean> {
  const row = await prisma.userTwoFactorAuth.findUnique({ where: { userId } });
  if (!row?.enabled) return false;
  const secret = decryptSecret(row.secretEnc);
  return authenticator.check(code.replace(/\s/g, ""), secret);
}
