import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { RenderedEmail, SecurityAlertTemplateInput } from "../types.js";

export function renderSecurityAlertEmail(input: SecurityAlertTemplateInput): RenderedEmail {
  const subject = `ServeOS security alert: ${input.alertTitle}`;
  const ipLine = input.ipMasked
    ? `<p>Location/IP: <strong>${escapeHtml(input.ipMasked)}</strong></p>`
    : "";
  return {
    subject,
    html: renderEmailShell({
      title: input.alertTitle,
      preheader: input.detail,
      bodyHtml: `<p>${escapeHtml(input.detail)}</p>${ipLine}<p>If this wasn&apos;t you, change your password and review active sessions in your profile.</p>`,
      preferencesUrl: input.preferencesUrl,
      footerNote: "Security alerts cannot be unsubscribed — they protect your account."
    }),
    text: plainTextEmail(subject, [
      input.detail,
      input.ipMasked ? `IP: ${input.ipMasked}` : "",
      "If this wasn't you, change your password and review active sessions."
    ])
  };
}
