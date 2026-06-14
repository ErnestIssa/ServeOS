import { sendTransactionalEmail, type SendEmailResult } from "./emailProvider.js";

function appBaseUrl(): string {
  return (
    process.env.CUSTOMER_WEB_URL?.trim() ||
    process.env.WEB_ADMIN_URL?.trim() ||
    "https://app.serveos.se"
  ).replace(/\/$/, "");
}

function emailShell(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const ctaBlock = cta
    ? `<p style="margin:28px 0 0"><a href="${cta.href}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${cta.label}</a></p>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed">ServeOS</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
<div style="font-size:15px;line-height:1.6;color:#475569">${bodyHtml}</div>
${ctaBlock}
<p style="margin:28px 0 0;font-size:12px;color:#94a3b8">If you did not request this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function plain(title: string, lines: string[]) {
  return [title, "", ...lines, "", "— ServeOS"].join("\n");
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const result = await sendTransactionalEmail(params);
  if (!result.ok) {
    throw Object.assign(new Error(result.error), { statusCode: 502 });
  }
  return result;
}

export async function sendEmailChangeVerification(params: {
  to: string;
  token: string;
  expiresHours: number;
}) {
  const confirmUrl = `${appBaseUrl()}/admin?emailChangeToken=${encodeURIComponent(params.token)}`;
  return send({
    to: params.to,
    subject: "Confirm your new ServeOS email",
    html: emailShell(
      "Confirm your email change",
      `<p>We received a request to update the email on your ServeOS account.</p>
       <p>This link expires in <strong>${params.expiresHours} hours</strong>.</p>`,
      { label: "Verify email address", href: confirmUrl }
    ),
    text: plain("Confirm your ServeOS email", [
      "Open this link to verify your new email address:",
      confirmUrl,
      `Expires in ${params.expiresHours} hours.`
    ])
  });
}

export async function sendPasswordResetEmail(params: { to: string; token: string; expiresHours: number }) {
  const resetUrl = `${appBaseUrl()}/login?resetToken=${encodeURIComponent(params.token)}`;
  return send({
    to: params.to,
    subject: "Reset your ServeOS password",
    html: emailShell(
      "Reset your password",
      `<p>We received a request to reset your ServeOS password.</p>
       <p>This link expires in <strong>${params.expiresHours} hours</strong>.</p>`,
      { label: "Reset password", href: resetUrl }
    ),
    text: plain("Reset your ServeOS password", [
      "Open this link to choose a new password:",
      resetUrl,
      `Expires in ${params.expiresHours} hours.`
    ])
  });
}

export async function sendSecurityAlertEmail(params: {
  to: string;
  title: string;
  detail: string;
  ipMasked?: string | null;
}) {
  const ipLine = params.ipMasked ? `<p>Location/IP: <strong>${params.ipMasked}</strong></p>` : "";
  return send({
    to: params.to,
    subject: `ServeOS security alert: ${params.title}`,
    html: emailShell(
      params.title,
      `<p>${params.detail}</p>${ipLine}<p>If this wasn't you, change your password and review active sessions in your profile.</p>`
    ),
    text: plain(`ServeOS security alert: ${params.title}`, [
      params.detail,
      params.ipMasked ? `IP: ${params.ipMasked}` : "",
      "If this wasn't you, change your password and review active sessions."
    ].filter(Boolean))
  });
}

export async function sendStaffInvitationEmail(params: {
  to: string;
  fullName: string;
  restaurantName: string;
  intendedRole: string;
  acceptUrl: string;
  expiresAt: string;
}) {
  return send({
    to: params.to,
    subject: `You're invited to ${params.restaurantName} on ServeOS`,
    html: emailShell(
      `Join ${params.restaurantName}`,
      `<p>Hi ${params.fullName},</p>
       <p>You've been invited as <strong>${params.intendedRole}</strong> at <strong>${params.restaurantName}</strong>.</p>
       <p>Invitation expires <strong>${params.expiresAt}</strong>.</p>`,
      { label: "Accept invitation", href: params.acceptUrl }
    ),
    text: plain(`Invitation to ${params.restaurantName}`, [
      `Hi ${params.fullName},`,
      `You've been invited as ${params.intendedRole}.`,
      `Accept: ${params.acceptUrl}`,
      `Expires: ${params.expiresAt}`
    ])
  });
}

export async function sendOwnershipTransferEmail(params: {
  to: string;
  restaurantName: string;
  fromEmail?: string | null;
}) {
  return send({
    to: params.to,
    subject: "ServeOS ownership transfer request",
    html: emailShell(
      "Ownership transfer request",
      `<p>You have been nominated to receive ownership of <strong>${params.restaurantName}</strong> on ServeOS.</p>
       <p>${params.fromEmail ? `Requested by ${params.fromEmail}. ` : ""}Our team will verify this request before it completes.</p>`
    ),
    text: plain("ServeOS ownership transfer", [
      `You have been nominated to receive ownership of ${params.restaurantName}.`,
      params.fromEmail ? `Requested by ${params.fromEmail}.` : "",
      "Our team will verify this request before it completes."
    ].filter(Boolean))
  });
}

export async function sendAccountClosureEmail(params: { to: string; coolingUntil: string }) {
  return send({
    to: params.to,
    subject: "ServeOS account closure request received",
    html: emailShell(
      "Account closure request received",
      `<p>We received your account closure request.</p>
       <p>A cooling period applies until <strong>${params.coolingUntil}</strong> before support review.</p>`
    ),
    text: plain("Account closure request", [
      "We received your account closure request.",
      `Cooling period until ${params.coolingUntil}.`
    ])
  });
}

export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  return send({
    to: params.to,
    subject: params.subject,
    html: emailShell(
      params.title,
      `<p>${params.body}</p>`,
      params.actionUrl && params.actionLabel
        ? { label: params.actionLabel, href: params.actionUrl }
        : undefined
    ),
    text: plain(params.title, [params.body, params.actionUrl ? `Open: ${params.actionUrl}` : ""].filter(Boolean))
  });
}
