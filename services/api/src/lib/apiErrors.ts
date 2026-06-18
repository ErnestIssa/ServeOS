/** Backend SSOT for API error codes → user-facing messages. Clients should display `message`. */
const MESSAGES: Record<string, string> = {
  sms_not_configured: "SMS is not available right now.",
  sms_trial_unverified_number: "SMS could not be sent. On Twilio trial accounts, recipient numbers must be verified first.",
  sms_fallback_unavailable: "SMS sign-in codes are not available right now.",
  "2fa_not_enabled": "Two-factor authentication is not enabled on this account.",
  invalid_phone: "Enter a valid phone number.",
  invalid_current_password: "Current password is incorrect.",
  password_mismatch: "New passwords do not match.",
  password_too_short: "Password must be at least 8 characters.",
  password_needs_lowercase: "Include a lowercase letter in your password.",
  password_needs_uppercase: "Include an uppercase letter in your password.",
  password_needs_number: "Include a number in your password.",
  password_same_as_current: "Choose a different password than your current one.",
  email_in_use: "That email is already registered.",
  email_unchanged: "That is already your email address.",
  invalid_password: "Password is incorrect.",
  invalid_2fa_code: "Authentication code is invalid.",
  "2fa_required": "Enter your two-factor code to continue.",
  cannot_revoke_current_session: "You cannot sign out your current session from here.",
  closure_already_pending: "An account closure request is already pending.",
  not_venue_owner: "You must be the venue owner to transfer ownership.",
  email_required: "Enter the new owner's email address.",
  invalid_credentials: "Email or password is incorrect. Check your details and try again.",
  invalid_or_expired_token: "This link is invalid or has expired. Request a new one.",
  user_not_found: "We could not complete this request. Try again.",
  email_send_failed: "We could not send the email. Try again in a moment.",
  object_storage_not_configured: "File storage is not available right now.",
  cloudflare_cdn_not_configured: "Media cache refresh is not available right now.",
  fcm_not_configured: "Push notifications are not available right now.",
  validation_error: "Check your input and try again.",
  missing_token: "Your session has ended. Please sign in again.",
  token_revoked: "Your session has ended. Please sign in again.",
  session_revoked: "Your session has ended. Please sign in again.",
  forbidden: "You do not have permission to do that.",
  not_found: "We could not find what you requested.",
  server_error: "Something went wrong. Try again.",
  user_already_exists: "That email is already registered — use Log in instead.",
  identity_exists_use_login:
    "This email already has a ServeOS account. Sign in to join this workspace — no new account is needed.",
  email_or_phone_required: "Email or phone is required.",
  guest_signup_mobile_only: "Guest accounts can only be created in the ServeOS mobile app.",
  business_signup_web_only: "Business accounts can only be created on the ServeOS website.",
  invalid_registration_profile: "Signup data was rejected. Check your details and try again.",
  accept_failed: "Could not accept the invitation. Try again.",
  server_misconfigured: "The server is not configured correctly. Try again later.",
  invalid_token: "Your session has ended. Please sign in again.",
  sign_in_failed: "Could not sign in. Try again.",
  account_suspended: "Your workspace access is suspended. Contact your restaurant admin.",
  account_merged: "This account was merged into another login. Use your primary account.",
  pending_account_completion: "Finish setting up your account before signing in.",
  account_temporarily_locked: "Too many failed sign-in attempts. Try again in a few minutes.",
  too_many_attempts: "Too many sign-in attempts. Wait a moment and try again.",
  invitation_already_used: "This invitation has already been used.",
  login_required: "Sign in to continue.",
  email_mismatch: "This invite was sent to a different email address.",
  account_already_exists: "An account already exists for this email. Sign in instead.",
  sign_up_failed: "Could not create your account. Try again."
};

export function apiErrorMessage(code?: string | null): string {
  if (!code) return MESSAGES.server_error;
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.startsWith("resend_") || code.startsWith("http_error")) {
    return "We could not send the email. Try again in a moment.";
  }
  if (code.startsWith("bad_response") || code.startsWith("http_error")) {
    return "Could not reach the server. Try again later.";
  }
  return code;
}

export function apiFail<T extends Record<string, unknown> = Record<string, never>>(
  error: string,
  extra?: T
) {
  return {
    ok: false as const,
    error,
    message: apiErrorMessage(error),
    ...(extra ?? {})
  };
}

export function enrichApiPayload<T extends { ok?: boolean; error?: string; message?: string }>(
  payload: T
): T {
  if (payload.ok === false && payload.error && !payload.message) {
    return { ...payload, message: apiErrorMessage(payload.error) };
  }
  return payload;
}
