import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { NotificationTemplateInput, RenderedEmail } from "../types.js";

export function renderNotificationEmail(input: NotificationTemplateInput): RenderedEmail {
  const cta =
    input.actionUrl && input.actionLabel
      ? { label: input.actionLabel, href: input.actionUrl }
      : undefined;
  return {
    subject: input.subject,
    html: renderEmailShell({
      title: input.title,
      preheader: input.body,
      bodyHtml: `<p>${escapeHtml(input.body)}</p>`,
      cta,
      preferencesUrl: input.preferencesUrl
    }),
    text: plainTextEmail(input.title, [input.body, input.actionUrl ? `Open: ${input.actionUrl}` : ""])
  };
}
