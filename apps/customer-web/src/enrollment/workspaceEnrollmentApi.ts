import { getApiBaseUrl } from "../api";
import { readStoredAdminToken } from "../authStorage";

export type InviteResolveOk = {
  ok: true;
  status: "VALID";
  invite: {
    kind: "staff" | "customer";
    invitationId: string;
    restaurantId: string;
    restaurantName: string;
    inviteEmailMasked: string;
    inviteEmail: string;
    fullName: string | null;
    intendedRole: string;
    roleLabel: string;
    expiresAt: string;
    invitedBy?: { name: string; roleLabel: string } | null;
  };
  identity: { state: "NEW" | "EXISTING" | "DUAL_ACCOUNT" | "ALREADY_JOINED"; exists: boolean; hasUsableAccount: boolean };
  membershipAtVenue: {
    role: string;
    status: string;
    isOperational: boolean;
  } | null;
  session: {
    state: "NONE" | "MATCHES_INVITE" | "MISMATCH";
    user?: { emailMasked: string; fullName: string | null };
  };
  actions: {
    canCreateAccount: boolean;
    canUseExisting: boolean;
    canMerge: boolean;
    requiresLogin: boolean;
    requiresSwitchAccount: boolean;
    requiresSignOutToCreate: boolean;
    recommended: "create_account" | "use_existing" | "login" | "switch_account" | "merge" | "none";
  };
};

export type InviteResolveFail = {
  ok: false;
  error: string;
  status?: string;
};

export type EnrollmentAcceptOk = {
  ok: true;
  token: string;
  pendingApproval: boolean;
  restaurantId: string;
  intendedRole: string;
  redirectPath: string;
  merged: boolean;
  user: { id: string; email?: string | null; phone?: string | null; role?: string };
};

function authHeaders(): Record<string, string> {
  const token = readStoredAdminToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: text || "bad_response" } as T;
  }
}

export async function resolveWorkspaceInvite(
  token: string
): Promise<InviteResolveOk | InviteResolveFail> {
  const res = await fetch(
    `${getApiBaseUrl()}/workspace-enrollment/resolve?token=${encodeURIComponent(token)}`,
    { headers: authHeaders() }
  );
  return parseJson(res);
}

export async function acceptWorkspaceEnrollment(input: {
  token: string;
  action: "create_account" | "use_existing" | "merge_accounts";
  password?: string;
  fullName?: string;
  phone?: string;
  mergeConfirm?: boolean;
}): Promise<EnrollmentAcceptOk | { ok: false; error: string }> {
  const res = await fetch(`${getApiBaseUrl()}/workspace-enrollment/accept`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input)
  });
  return parseJson(res);
}

export const ENROLLMENT_ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "This invitation link is not valid.",
  invitation_expired: "This invitation has expired. Ask your manager for a new link.",
  invitation_revoked: "This invitation was cancelled.",
  invitation_already_used: "This invitation has already been used.",
  account_suspended: "Your workspace access is suspended. Contact your restaurant admin.",
  account_merged: "This account was merged into another login. Use your primary account.",
  pending_account_completion: "Finish setting up your account before signing in.",
  account_temporarily_locked: "Too many failed sign-in attempts. Try again in a few minutes.",
  too_many_attempts: "Too many sign-in attempts. Wait a moment and try again.",
  already_member: "You are already connected to this workspace.",
  password_required: "Choose a password to create your account.",
  invalid_credentials: "Incorrect password. Try again.",
  email_mismatch: "This account does not match the invited email.",
  merge_not_confirmed: "Confirm account merge to continue.",
  account_already_exists: "An account already exists for this email. Sign in instead.",
  identity_exists_use_login:
    "This email already has a ServeOS account. Sign in to join this workspace — no new account is needed.",
  use_existing_account: "You are already signed in with the invited email. Continue with this account instead.",
  login_required: "Sign in to continue with your existing account."
};

export function enrollmentErrorMessage(code?: string): string {
  if (!code) return "Something went wrong. Please try again.";
  return ENROLLMENT_ERROR_MESSAGES[code] ?? code.replace(/_/g, " ");
}
