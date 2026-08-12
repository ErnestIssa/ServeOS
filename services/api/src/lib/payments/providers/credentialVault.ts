import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function credentialKey(): Buffer | null {
  const raw = process.env.PAYMENT_CREDENTIALS_KEY?.trim() || process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
  version: 1;
};

/** Encrypt a secret for storage. Never log plaintext. */
export function encryptPaymentSecret(plaintext: string): EncryptedSecret | null {
  const key = credentialKey();
  if (!key || !plaintext) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    version: 1
  };
}

/** Decrypt for adapter use only — never return from public APIs. */
export function decryptPaymentSecret(secret: EncryptedSecret | null | undefined): string | null {
  if (!secret?.ciphertext || !secret.iv || !secret.tag) return null;
  const key = credentialKey();
  if (!key) return null;
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(secret.iv, "base64"));
    decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, "base64")),
      decipher.final()
    ]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(value?: string | null): string {
  if (!value) return "Not configured";
  if (value.length <= 4) return "••••";
  return `••••••••${value.slice(-4)}`;
}

export function secretConfiguredLabel(configured: boolean): "Configured" | "Not configured" {
  return configured ? "Configured" : "Not configured";
}
