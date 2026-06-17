import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { OwnershipTransferTemplateInput, RenderedEmail } from "../types.js";

export function renderOwnershipTransferEmail(input: OwnershipTransferTemplateInput): RenderedEmail {
  const subject = "ServeOS ownership transfer request";
  const fromLine = input.fromEmail
    ? `<p>Requested by <strong>${escapeHtml(input.fromEmail)}</strong>.</p>`
    : "";
  return {
    subject,
    html: renderEmailShell({
      title: "Ownership transfer request",
      preheader: `Ownership transfer for ${input.restaurantName}.`,
      bodyHtml: `<p>You have been nominated to receive ownership of <strong>${escapeHtml(input.restaurantName)}</strong> on ServeOS.</p>
${fromLine}
<p>Our team will verify this request before it completes.</p>`,
      preferencesUrl: input.preferencesUrl
    }),
    text: plainTextEmail(subject, [
      `You have been nominated to receive ownership of ${input.restaurantName}.`,
      input.fromEmail ? `Requested by ${input.fromEmail}.` : "",
      "Our team will verify this request before it completes."
    ])
  };
}
