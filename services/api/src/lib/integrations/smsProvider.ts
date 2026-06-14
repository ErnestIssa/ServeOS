/**
 * Twilio SMS — cache/transactional only. Credentials from env; email remains primary.
 * Trial accounts may only send to verified recipient numbers (Twilio error 21608).
 */

export type SendSmsParams = {
  to: string;
  body: string;
};

export type SendSmsResult =
  | { ok: true; messageSid?: string }
  | { ok: false; skipped?: boolean; error?: string };

const TWILIO_TRIAL_UNVERIFIED = new Set([21608, 21211]);

export function twilioPhoneNumber(): string | undefined {
  return (
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    process.env.TWILIO_FROM_NUMBER?.trim()
  );
}

export function isSmsProviderConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      twilioPhoneNumber()
  );
}

/** Normalize to E.164-ish `+` prefix for Twilio. */
export function normalizeSmsPhone(raw: string): string | null {
  const t = raw.trim().replace(/[\s().-]/g, "");
  if (!t) return null;
  if (t.startsWith("+")) return t;
  if (t.startsWith("00")) return `+${t.slice(2)}`;
  if (/^\d{8,15}$/.test(t)) return `+${t}`;
  return null;
}

function mapTwilioError(status: number, payload: { code?: number; message?: string }): string {
  const code = payload.code;
  if (code && TWILIO_TRIAL_UNVERIFIED.has(code)) return "sms_trial_unverified_number";
  if (status === 401 || status === 403) return "sms_auth_failed";
  return payload.message?.trim() || `twilio_http_${status}`;
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = twilioPhoneNumber();

  if (!sid || !token || !from) {
    return { ok: false, skipped: true, error: "sms_not_configured" };
  }

  const to = normalizeSmsPhone(params.to);
  if (!to) {
    return { ok: false, error: "invalid_phone" };
  }

  const body = params.body.trim().slice(0, 1600);
  if (!body) {
    return { ok: false, error: "empty_sms_body" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ To: to, From: from, Body: body });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });

    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      code?: number;
      message?: string;
    };

    if (!res.ok) {
      const error = mapTwilioError(res.status, data);
      console.warn("[sms] Twilio send failed", { status: res.status, code: data.code, to, error });
      return { ok: false, error };
    }

    return { ok: true, messageSid: data.sid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sms_request_failed";
    console.warn("[sms] Twilio request error", msg);
    return { ok: false, error: msg };
  }
}
