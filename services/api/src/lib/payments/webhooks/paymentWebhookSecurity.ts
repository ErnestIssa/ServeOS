import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type WebhookVerificationInput = {
  provider: string;
  rawBody: string | Buffer;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
  secret?: string | null;
  /** Max age for timestamped signatures (ms). */
  maxSkewMs?: number;
};

export type WebhookVerificationResult =
  | { ok: true; provider: string; payloadHash: string }
  | { ok: false; error: string; statusCode: number };

function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Verify provider webhook authenticity.
 * Supports ServeOS shared secret header and Stripe-like `t=...,v1=...` signatures.
 */
export function verifyPaymentWebhookSignature(input: WebhookVerificationInput): WebhookVerificationResult {
  const raw = typeof input.rawBody === "string" ? input.rawBody : input.rawBody.toString("utf8");
  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const secret = input.secret?.trim();

  if (!secret) {
    // Dev without secret: accept but mark as unverified path via caller policy.
    return { ok: true, provider: input.provider, payloadHash };
  }

  const sig = (input.signatureHeader ?? "").trim();
  if (!sig) {
    return { ok: false, error: "webhook_signature_missing", statusCode: 401 };
  }

  // Stripe-style
  if (sig.includes("t=") && sig.includes("v1=")) {
    const parts = Object.fromEntries(
      sig.split(",").map((p) => {
        const [k, ...rest] = p.split("=");
        return [k.trim(), rest.join("=").trim()];
      })
    );
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return { ok: false, error: "webhook_signature_malformed", statusCode: 401 };
    const ts = Number(t);
    const maxSkew = input.maxSkewMs ?? 5 * 60 * 1000;
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > maxSkew) {
      return { ok: false, error: "webhook_signature_expired", statusCode: 401 };
    }
    const expected = hmacSha256Hex(secret, `${t}.${raw}`);
    if (!safeEqualHex(expected, v1)) {
      return { ok: false, error: "webhook_signature_invalid", statusCode: 401 };
    }
    return { ok: true, provider: input.provider, payloadHash };
  }

  // Simple shared secret / HMAC of body
  const expectedSimple = hmacSha256Hex(secret, raw);
  if (safeEqualHex(expectedSimple, sig) || safeEqualHex(secret, sig)) {
    return { ok: true, provider: input.provider, payloadHash };
  }

  return { ok: false, error: "webhook_signature_invalid", statusCode: 401 };
}

export type ProviderEventRecord = {
  provider: string;
  providerEventId: string;
  eventType: string;
  restaurantId?: string | null;
  orderId?: string | null;
  attemptId?: string | null;
  eventTimestamp?: string | null;
  receivedAt: string;
  processedAt?: string | null;
  processingResult?: string | null;
  payloadHash: string;
  signatureValid: boolean;
};

/** In-process ledger for tests / bootstrap; production persists via OrderIdempotencyKey or DB. */
const MEMORY_EVENTS = new Map<string, ProviderEventRecord>();

export function providerEventKey(provider: string, providerEventId: string): string {
  return `${provider}::${providerEventId}`;
}

export function rememberProviderEvent(record: ProviderEventRecord): {
  duplicate: boolean;
  record: ProviderEventRecord;
} {
  const key = providerEventKey(record.provider, record.providerEventId);
  const existing = MEMORY_EVENTS.get(key);
  if (existing) return { duplicate: true, record: existing };
  MEMORY_EVENTS.set(key, record);
  return { duplicate: false, record };
}

export function getRememberedProviderEvent(provider: string, providerEventId: string) {
  return MEMORY_EVENTS.get(providerEventKey(provider, providerEventId)) ?? null;
}

export function clearRememberedProviderEvents() {
  MEMORY_EVENTS.clear();
}

/** Redact sensitive fields before storing/logging webhook payloads. */
export function redactPaymentPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const out: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("secret") ||
      lower.includes("cvv") ||
      lower.includes("cvc") ||
      lower.includes("pan") ||
      lower.includes("card_number") ||
      lower.includes("cardnumber") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("authorization")
    ) {
      out[key] = "[redacted]";
    }
  }
  return out;
}
