import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { EmailChangeTemplateInput, RenderedEmail } from "../types.js";

export function renderEmailChangeEmail(input: EmailChangeTemplateInput): RenderedEmail {
  const subject = "Confirm your new ServeOS email";
  return {
    subject,
    html: renderEmailShell({
      title: "Confirm your email change",
      preheader: "Verify your new ServeOS email address.",
      bodyHtml: `<p>We received a request to update the email on your ServeOS account.</p>
<p>This link expires in <strong>${input.expiresHours} hours</strong>.</p>`,
      cta: { label: "Verify email address", href: input.confirmUrl },
      preferencesUrl: input.preferencesUrl
    }),
    text: plainTextEmail(subject, [
      "We received a request to update your ServeOS email.",
      `Open this link to verify: ${input.confirmUrl}`,
      `Expires in ${input.expiresHours} hours.`
    ])
  };
}
