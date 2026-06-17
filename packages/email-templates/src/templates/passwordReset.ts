import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { PasswordResetTemplateInput, RenderedEmail } from "../types.js";

export function renderPasswordResetEmail(input: PasswordResetTemplateInput): RenderedEmail {
  const subject = "Reset your ServeOS password";
  return {
    subject,
    html: renderEmailShell({
      title: "Reset your password",
      preheader: "Use this secure link to choose a new ServeOS password.",
      bodyHtml: `<p>We received a request to reset the password on your ServeOS account.</p>
<p>This link expires in <strong>${input.expiresHours} hours</strong>.</p>`,
      cta: { label: "Reset password", href: input.resetUrl },
      preferencesUrl: input.preferencesUrl
    }),
    text: plainTextEmail(subject, [
      "We received a request to reset your ServeOS password.",
      `Open this link to choose a new password: ${input.resetUrl}`,
      `Expires in ${input.expiresHours} hours.`
    ])
  };
}
