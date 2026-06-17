import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { AccountClosureTemplateInput, RenderedEmail } from "../types.js";

export function renderAccountClosureEmail(input: AccountClosureTemplateInput): RenderedEmail {
  const subject = "ServeOS account closure request received";
  return {
    subject,
    html: renderEmailShell({
      title: "Account closure request received",
      preheader: "Your ServeOS account closure request is in a cooling period.",
      bodyHtml: `<p>We received your account closure request.</p>
<p>A cooling period applies until <strong>${escapeHtml(input.coolingUntil)}</strong> before support review.</p>`,
      preferencesUrl: input.preferencesUrl
    }),
    text: plainTextEmail(subject, [
      "We received your account closure request.",
      `Cooling period until ${input.coolingUntil}.`
    ])
  };
}
