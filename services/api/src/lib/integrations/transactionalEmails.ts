import { dispatchServeOsEmail, type DispatchEmailInput } from "../emailDispatchService.js";
import type { SendEmailResult } from "./emailProvider.js";

/**
 * @deprecated Import dispatchServeOsEmail from emailDispatchService — kept for existing call sites.
 * All HTML layout is rendered by @serveos/email-templates.
 */

export async function sendEmailChangeVerification(params: {
  to: string;
  token: string;
  expiresHours: number;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "email_change",
    to: params.to,
    token: params.token,
    expiresHours: params.expiresHours
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  token: string;
  expiresHours: number;
  returnTo?: string | null;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "password_reset",
    to: params.to,
    token: params.token,
    expiresHours: params.expiresHours,
    returnTo: params.returnTo ?? undefined
  });
}

export async function sendSecurityAlertEmail(params: {
  to: string;
  title: string;
  detail: string;
  ipMasked?: string | null;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "security_alert",
    to: params.to,
    alertTitle: params.title,
    detail: params.detail,
    ipMasked: params.ipMasked
  });
}

export async function sendStaffInvitationEmail(params: {
  to: string;
  fullName: string;
  restaurantName: string;
  intendedRole: string;
  acceptUrl: string;
  expiresAt: string;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "staff_invitation",
    to: params.to,
    fullName: params.fullName,
    restaurantName: params.restaurantName,
    intendedRole: params.intendedRole,
    acceptUrl: params.acceptUrl,
    expiresAt: params.expiresAt
  });
}

export async function sendOwnershipTransferEmail(params: {
  to: string;
  restaurantName: string;
  fromEmail?: string | null;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "ownership_transfer",
    to: params.to,
    restaurantName: params.restaurantName,
    fromEmail: params.fromEmail
  });
}

export async function sendAccountClosureEmail(params: {
  to: string;
  coolingUntil: string;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "account_closure",
    to: params.to,
    coolingUntil: params.coolingUntil
  });
}

export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "notification",
    to: params.to,
    subject: params.subject,
    title: params.title,
    body: params.body,
    actionUrl: params.actionUrl,
    actionLabel: params.actionLabel
  });
}

export async function sendCommunicationPreferencesEmail(params: {
  to: string;
  token: string;
  emailMasked?: string;
}): Promise<SendEmailResult> {
  return dispatchServeOsEmail({
    template: "communication_preferences",
    to: params.to,
    token: params.token,
    emailMasked: params.emailMasked
  });
}

export type { DispatchEmailInput };
