import { SERVEOS_EMAIL_BRAND as b } from "./brand.js";
import { escapeHtml } from "./escape.js";

export type EmailShellCta = {
  label: string;
  href: string;
};

export type EmailShellOptions = {
  title: string;
  preheader?: string;
  bodyHtml: string;
  cta?: EmailShellCta;
  footerNote?: string;
  preferencesUrl?: string;
  showDefaultFooter?: boolean;
};

function wordmarkHtml(): string {
  return `<span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${b.slate900}">Serve<span style="color:${b.violet}">OS</span></span>`;
}

export function renderEmailShell(options: EmailShellOptions): string {
  const title = escapeHtml(options.title);
  const preheader = options.preheader ? escapeHtml(options.preheader) : title;
  const footerNote =
    options.footerNote ??
    "If you did not request this, you can safely ignore this email.";
  const preferencesUrl = options.preferencesUrl?.trim();
  const showDefaultFooter = options.showDefaultFooter !== false;

  const ctaBlock = options.cta
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 0">
<tr><td align="center" style="border-radius:999px;background:linear-gradient(135deg,${b.violet},${b.blue})">
<a href="${escapeHtml(options.cta.href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:${b.white};text-decoration:none;border-radius:999px">${escapeHtml(options.cta.label)}</a>
</td></tr></table>`
    : "";

  const preferencesFooter = preferencesUrl
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${b.slate400}">
<a href="${escapeHtml(preferencesUrl)}" style="color:${b.violet};text-decoration:underline">Manage communication preferences</a>
</p>`
    : "";

  const defaultFooter = showDefaultFooter
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${b.slate400}">${escapeHtml(footerNote)}</p>
${preferencesFooter}
<p style="margin:20px 0 0;font-size:11px;color:${b.slate400}">© ServeOS · Restaurant operations platform</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${b.slate50};font-family:${b.fontFamily};color:${b.slate900}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${b.slate50}">
<tr><td align="center" style="padding:36px 16px">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:${b.white};border:1px solid ${b.slate200};border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.06)">
<tr><td style="height:4px;background:linear-gradient(90deg,${b.violet},${b.blue});font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px">${wordmarkHtml()}</td></tr>
<tr><td style="padding:8px 28px 28px">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;color:${b.slate900}">${title}</h1>
<div style="font-size:15px;line-height:1.65;color:${b.slate600}">${options.bodyHtml}</div>
${ctaBlock}
${defaultFooter}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
