import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { RenderedEmail, StaffInvitationTemplateInput } from "../types.js";

export function renderStaffInvitationEmail(input: StaffInvitationTemplateInput): RenderedEmail {
  const subject = `You're invited to ${input.restaurantName} on ServeOS`;
  return {
    subject,
    html: renderEmailShell({
      title: `Join ${escapeHtml(input.restaurantName)}`,
      preheader: `You've been invited as ${input.intendedRole} on ServeOS.`,
      bodyHtml: `<p>Hi ${escapeHtml(input.fullName)},</p>
<p>You&apos;ve been invited as <strong>${escapeHtml(input.intendedRole)}</strong> at <strong>${escapeHtml(input.restaurantName)}</strong>.</p>
<p>Invitation expires <strong>${escapeHtml(input.expiresAt)}</strong>.</p>`,
      cta: { label: "Accept invitation", href: input.acceptUrl },
      preferencesUrl: input.preferencesUrl,
      footerNote: "Staff invitations are required system messages and cannot be unsubscribed."
    }),
    text: plainTextEmail(subject, [
      `Hi ${input.fullName},`,
      `You've been invited as ${input.intendedRole} at ${input.restaurantName}.`,
      `Accept: ${input.acceptUrl}`,
      `Expires: ${input.expiresAt}`
    ])
  };
}
