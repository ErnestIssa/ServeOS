export const DEFAULT_RESEND_FROM = "ServeOS <noreply@mail.serveos.se>";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export function resendFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_RESEND_FROM;
}

export function requireResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required for transactional email");
  }
  return apiKey;
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Send via Resend — no stubs; fails when API key is missing or Resend rejects the send. */
export async function sendTransactionalEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = requireResendApiKey();
  const to = params.to.trim().toLowerCase();
  if (!to) return { ok: false, error: "invalid_recipient" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFromAddress(),
      to: [to],
      subject: params.subject,
      html: params.html,
      text: params.text
    })
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `resend_${res.status}:${body.slice(0, 200)}` };
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) return { ok: false, error: "resend_missing_id" };
  return { ok: true, id: data.id };
}
