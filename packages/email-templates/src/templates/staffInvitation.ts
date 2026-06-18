import { escapeHtml } from "../escape.js";
import { plainTextEmail } from "../plainText.js";
import { renderEmailShell } from "../shell.js";
import type { RenderedEmail, StaffInvitationTemplateInput } from "../types.js";

const ROLE_SUMMARIES: Record<string, string> = {
  STAFF: "take orders, manage tables, and message guests",
  KITCHEN: "use the kitchen display (KDS) and update ticket status",
  CASHIER: "process checkout and order handoff",
  MANAGER: "manage full venue operations",
  OWNER: "manage the workspace and billing"
};

function roleSummary(role: string): string {
  return ROLE_SUMMARIES[role.toUpperCase()] ?? "work in your assigned venue tools";
}

export function renderStaffInvitationEmail(input: StaffInvitationTemplateInput): RenderedEmail {
  const roleLabel = input.roleLabel ?? input.intendedRole;
  const subject = `You're invited to ${input.restaurantName} on ServeOS`;
  const inviterLine = input.invitedByName
    ? `<p>Invited by: <strong>${escapeHtml(input.invitedByName)}</strong>${
        input.invitedByRole ? ` (${escapeHtml(input.invitedByRole)})` : ""
      }</p>`
    : "";

  return {
    subject,
    html: renderEmailShell({
      title: `Join ${escapeHtml(input.restaurantName)}`,
      preheader: `You've been invited as ${roleLabel} on ServeOS.`,
      bodyHtml: `<p>Hi ${escapeHtml(input.fullName)},</p>
<p>You have been invited to join <strong>${escapeHtml(input.restaurantName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.</p>
${inviterLine}
<p>After accepting:</p>
<ul>
  <li>Your ServeOS account will be created or linked</li>
  <li>A restaurant admin will approve your access</li>
  <li>You will be able to ${escapeHtml(roleSummary(input.intendedRole))}</li>
</ul>
<p>Invitation expires <strong>${escapeHtml(input.expiresAt)}</strong>.</p>`,
      cta: { label: "Accept invitation", href: input.acceptUrl },
      preferencesUrl: input.preferencesUrl,
      footerNote: "Staff invitations are required system messages and cannot be unsubscribed."
    }),
    text: plainTextEmail(subject, [
      `Hi ${input.fullName},`,
      `You have been invited to join ${input.restaurantName} as ${roleLabel}.`,
      input.invitedByName ? `Invited by: ${input.invitedByName}${input.invitedByRole ? ` (${input.invitedByRole})` : ""}` : "",
      "After accepting: your account is created or linked, an admin approves access, then you can start working.",
      `Accept: ${input.acceptUrl}`,
      `Expires: ${input.expiresAt}`
    ])
  };
}
