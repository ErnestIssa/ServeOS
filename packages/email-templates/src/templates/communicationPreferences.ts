import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { CommunicationPreferencesTemplateInput, RenderedEmail } from "../types.js";

export function renderCommunicationPreferencesEmail(
  input: CommunicationPreferencesTemplateInput
): RenderedEmail {
  const subject = "Manage your ServeOS communication preferences";
  const identityLine = input.emailMasked
    ? `<p>This link is for <strong>${escapeHtml(input.emailMasked)}</strong>.</p>`
    : "";
  return {
    subject,
    html: renderEmailShell({
      title: "Manage your communication preferences",
      preheader: "Control marketing, newsletter, and optional notifications from ServeOS.",
      bodyHtml: `<p>Control what emails and notifications you receive from ServeOS.</p>
${identityLine}
<p>Billing, security, and legal messages always stay on — this link only manages optional communications.</p>`,
      cta: { label: "Open preference center", href: input.preferencesUrl },
      showDefaultFooter: false,
      footerNote: "If you did not request this link, you can ignore this email."
    }),
    text: plainTextEmail(subject, [
      "Open your ServeOS communication preference center:",
      input.preferencesUrl,
      "Billing, security, and legal messages always stay on."
    ])
  };
}
