import { renderAccountClosureEmail } from "./templates/accountClosure.js";
import { renderCommunicationPreferencesEmail } from "./templates/communicationPreferences.js";
import { renderEmailChangeEmail } from "./templates/emailChange.js";
import { renderNotificationEmail } from "./templates/notification.js";
import { renderOwnershipTransferEmail } from "./templates/ownershipTransfer.js";
import { renderPasswordResetEmail } from "./templates/passwordReset.js";
import { renderSecurityAlertEmail } from "./templates/securityAlert.js";
import { renderStaffInvitationEmail } from "./templates/staffInvitation.js";
import type { RenderedEmail, ServeOsEmailTemplateInput } from "./types.js";

/** Render branded HTML + plain text for a ServeOS transactional email. */
export function renderServeOsEmail(input: ServeOsEmailTemplateInput): RenderedEmail {
  switch (input.template) {
    case "password_reset":
      return renderPasswordResetEmail(input);
    case "email_change":
      return renderEmailChangeEmail(input);
    case "security_alert":
      return renderSecurityAlertEmail(input);
    case "staff_invitation":
      return renderStaffInvitationEmail(input);
    case "ownership_transfer":
      return renderOwnershipTransferEmail(input);
    case "account_closure":
      return renderAccountClosureEmail(input);
    case "notification":
      return renderNotificationEmail(input);
    case "communication_preferences":
      return renderCommunicationPreferencesEmail(input);
    default: {
      const _exhaustive: never = input;
      throw new Error(`unknown_email_template:${(_exhaustive as ServeOsEmailTemplateInput).template}`);
    }
  }
}

export type { RenderedEmail, ServeOsEmailTemplateInput, ServeOsEmailTemplateId } from "./types.js";
export { SERVEOS_EMAIL_BRAND } from "./brand.js";
export { renderEmailShell } from "./shell.js";
