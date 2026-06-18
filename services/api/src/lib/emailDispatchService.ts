import { renderServeOsEmail, type ServeOsEmailTemplateInput } from "@serveos/email-templates";
import {
  communicationPreferencesUrl,
  customerWebBaseUrl,
  defaultPreferencesFooterUrl,
  emailChangeConfirmUrl,
  passwordResetUrl
} from "./emailUrls.js";
import { isEmailProviderConfigured, sendTransactionalEmail, type SendEmailResult } from "./integrations/emailProvider.js";

export type DispatchEmailInput =
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "password_reset" }> & {
        token: string;
        expiresHours: number;
        returnTo?: string;
      })
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "email_change" }> & {
        token: string;
        expiresHours: number;
      })
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "security_alert" }>)
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "staff_invitation" }>)
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "ownership_transfer" }>)
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "account_closure" }>)
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "notification" }>)
  | ({ to: string } & Extract<ServeOsEmailTemplateInput, { template: "communication_preferences" }> & {
        token: string;
        emailMasked?: string;
      });

function withPreferencesFooter<T extends { preferencesUrl?: string }>(input: T): T {
  return { ...input, preferencesUrl: input.preferencesUrl ?? defaultPreferencesFooterUrl() };
}

function toTemplateInput(input: DispatchEmailInput): ServeOsEmailTemplateInput {
  const preferencesUrl = defaultPreferencesFooterUrl();

  switch (input.template) {
    case "password_reset":
      return withPreferencesFooter({
        template: "password_reset",
        resetUrl: passwordResetUrl(input.token, input.returnTo),
        expiresHours: input.expiresHours,
        preferencesUrl
      });
    case "email_change":
      return withPreferencesFooter({
        template: "email_change",
        confirmUrl: emailChangeConfirmUrl(input.token),
        expiresHours: input.expiresHours,
        preferencesUrl
      });
    case "security_alert":
      return withPreferencesFooter({
        template: "security_alert",
        alertTitle: input.alertTitle,
        detail: input.detail,
        ipMasked: input.ipMasked,
        preferencesUrl
      });
    case "staff_invitation":
      return withPreferencesFooter({
        template: "staff_invitation",
        fullName: input.fullName,
        restaurantName: input.restaurantName,
        intendedRole: input.intendedRole,
        roleLabel: input.roleLabel,
        invitedByName: input.invitedByName,
        invitedByRole: input.invitedByRole,
        acceptUrl: input.acceptUrl,
        expiresAt: input.expiresAt,
        preferencesUrl
      });
    case "ownership_transfer":
      return withPreferencesFooter({
        template: "ownership_transfer",
        restaurantName: input.restaurantName,
        fromEmail: input.fromEmail,
        preferencesUrl
      });
    case "account_closure":
      return withPreferencesFooter({
        template: "account_closure",
        coolingUntil: input.coolingUntil,
        preferencesUrl
      });
    case "notification":
      return withPreferencesFooter({
        template: "notification",
        subject: input.subject,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        preferencesUrl
      });
    case "communication_preferences":
      return {
        template: "communication_preferences",
        preferencesUrl: communicationPreferencesUrl(input.token),
        emailMasked: input.emailMasked
      };
    default: {
      const _exhaustive: never = input;
      throw new Error(`unsupported_email_template:${(_exhaustive as DispatchEmailInput).template}`);
    }
  }
}

/**
 * Single source of truth for outbound ServeOS email.
 * Layout/branding: @serveos/email-templates · Delivery: Resend via emailProvider.
 */
export async function dispatchServeOsEmail(input: DispatchEmailInput): Promise<SendEmailResult> {
  const rendered = renderServeOsEmail(toTemplateInput(input));
  const result = await sendTransactionalEmail({
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text
  });
  if (!result.ok) {
    throw Object.assign(new Error(result.error), { statusCode: 502 });
  }
  return result;
}

/** Best-effort send — never throws; for flows that must not leak provider errors to clients. */
export async function dispatchServeOsEmailSafe(
  input: DispatchEmailInput
): Promise<SendEmailResult | { ok: false; skipped: true }> {
  if (!isEmailProviderConfigured()) return { ok: false, skipped: true };
  try {
    return await dispatchServeOsEmail(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export { customerWebBaseUrl, communicationPreferencesUrl, passwordResetUrl };
