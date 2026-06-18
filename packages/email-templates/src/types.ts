export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplateBase = {
  preferencesUrl?: string;
};

export type PasswordResetTemplateInput = EmailTemplateBase & {
  template: "password_reset";
  resetUrl: string;
  expiresHours: number;
};

export type EmailChangeTemplateInput = EmailTemplateBase & {
  template: "email_change";
  confirmUrl: string;
  expiresHours: number;
};

export type SecurityAlertTemplateInput = EmailTemplateBase & {
  template: "security_alert";
  alertTitle: string;
  detail: string;
  ipMasked?: string | null;
};

export type StaffInvitationTemplateInput = EmailTemplateBase & {
  template: "staff_invitation";
  fullName: string;
  restaurantName: string;
  intendedRole: string;
  roleLabel?: string;
  invitedByName?: string | null;
  invitedByRole?: string | null;
  acceptUrl: string;
  expiresAt: string;
};

export type OwnershipTransferTemplateInput = EmailTemplateBase & {
  template: "ownership_transfer";
  restaurantName: string;
  fromEmail?: string | null;
};

export type AccountClosureTemplateInput = EmailTemplateBase & {
  template: "account_closure";
  coolingUntil: string;
};

export type NotificationTemplateInput = EmailTemplateBase & {
  template: "notification";
  subject: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
};

export type CommunicationPreferencesTemplateInput = EmailTemplateBase & {
  template: "communication_preferences";
  preferencesUrl: string;
  emailMasked?: string;
};

export type ServeOsEmailTemplateInput =
  | PasswordResetTemplateInput
  | EmailChangeTemplateInput
  | SecurityAlertTemplateInput
  | StaffInvitationTemplateInput
  | OwnershipTransferTemplateInput
  | AccountClosureTemplateInput
  | NotificationTemplateInput
  | CommunicationPreferencesTemplateInput;

export type ServeOsEmailTemplateId = ServeOsEmailTemplateInput["template"];
