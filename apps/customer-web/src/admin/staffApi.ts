import { getApiBaseUrl } from "../api";

function staffFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string> | undefined)
  };
  if (init?.body != null && init.body !== "") {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers
  }).then(async (res) => {
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok && data && typeof data === "object" && !("error" in data)) {
      return { ...data, ok: false, error: `http_${res.status}` } as T;
    }
    return data;
  });
}

export type ApiStaffActionCapability = {
  allowed: boolean;
  reason: string | null;
};

export type ApiStaffMemberCapabilities = {
  isSelf: boolean;
  canEditPermissions: boolean;
  permissionsReadOnly: boolean;
  readOnlyReason: string | null;
  canSavePermissions: boolean;
  actions: Record<string, ApiStaffActionCapability>;
};

export type ApiStaffMember = {
  id: string;
  userId: string;
  role: string;
  status: string;
  permissions: string[];
  permissionSummary: string;
  roleTemplate: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  approvedAt: string | null;
  createdAt: string;
  assignedLocations: string[];
  presence: string;
  lastActiveAt: string | null;
  lastActiveLabel: string;
  activeSessionsCount: number;
  currentShift: string | null;
  sessions: Array<{ id: string; device: string; location: string; lastActive: string; lastActiveAt: string; current: boolean }>;
  devices: Array<{ label: string; type: string; lastSeen: string }>;
  capabilities?: ApiStaffMemberCapabilities | null;
};

export type ApiStaffListResponse = {
  ok: boolean;
  error?: string;
  members?: ApiStaffMember[];
  pendingApprovals?: Array<{
    membershipId: string;
    userId: string;
    role: string;
    email: string | null;
    fullName: string | null;
    permissions: string[];
    createdAt: string;
  }>;
  pendingInvitations?: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    intendedRole: string;
    permissions: string[];
    expiresAt: string;
    createdAt: string;
  }>;
  accessPolicy?: { maxManagers: number; allowManagersToInviteManagers: boolean };
};

export type ApiPermissionGroup = {
  id: string;
  label: string;
  keys: string[];
  enabled: boolean;
};

export type ApiStaffDetailResponse = {
  ok: boolean;
  error?: string;
  member?: ApiStaffMember;
  permissionGroups?: ApiPermissionGroup[];
  auditLogs?: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
    metadata: unknown;
  }>;
};

export type ApiPermissionCatalog = {
  ok: boolean;
  invitableRoles: string[];
  groups: Array<{ id: string; label: string; keys: string[] }>;
};

export async function fetchStaffPermissionCatalog(token: string) {
  return staffFetch<ApiPermissionCatalog>(token, "/staff-access/permission-catalog");
}

export async function fetchVenueStaff(token: string, restaurantId: string) {
  return staffFetch<ApiStaffListResponse>(token, `/restaurants/${encodeURIComponent(restaurantId)}/staff`);
}

export async function fetchStaffMemberDetail(token: string, restaurantId: string, membershipId: string) {
  return staffFetch<ApiStaffDetailResponse>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}`
  );
}

export async function createStaffInvitation(
  token: string,
  restaurantId: string,
  body: {
    fullName: string;
    email: string;
    phone?: string;
    intendedRole: string;
    permissions?: string[];
  }
) {
  return staffFetch<{ ok: boolean; error?: string; invitationId?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/invitations`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function cancelStaffInvitation(token: string, restaurantId: string, invitationId: string) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/invitations/${encodeURIComponent(invitationId)}`,
    { method: "DELETE" }
  );
}

export async function approveStaffMembership(token: string, restaurantId: string, membershipId: string) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/approve`,
    { method: "POST", body: "{}" }
  );
}

export async function rejectStaffMembership(token: string, restaurantId: string, membershipId: string) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/reject`,
    { method: "POST", body: "{}" }
  );
}

export async function suspendStaffMembership(token: string, restaurantId: string, membershipId: string) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/suspend`,
    { method: "POST", body: "{}" }
  );
}

export async function activateStaffMembership(token: string, restaurantId: string, membershipId: string) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/activate`,
    { method: "POST", body: "{}" }
  );
}

export async function removeStaffMembership(token: string, restaurantId: string, membershipId: string) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}`,
    { method: "DELETE" }
  );
}

export async function updateStaffPermissions(
  token: string,
  restaurantId: string,
  membershipId: string,
  permissions: string[]
) {
  return staffFetch<{ ok: boolean; error?: string; permissions?: string[] }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/permissions`,
    { method: "PATCH", body: JSON.stringify({ permissions }) }
  );
}

export async function adminResetStaffPassword(
  token: string,
  restaurantId: string,
  membershipId: string,
  password: string
) {
  return staffFetch<{ ok: boolean; error?: string }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/reset-password`,
    { method: "POST", body: JSON.stringify({ password }) }
  );
}

export async function adminRevokeStaffSessions(
  token: string,
  restaurantId: string,
  membershipId: string,
  password: string
) {
  return staffFetch<{ ok: boolean; error?: string; sessionsRevoked?: number }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/revoke-sessions`,
    { method: "POST", body: JSON.stringify({ password }) }
  );
}

export function mapStaffApiError(error?: string): string {
  const map: Record<string, string> = {
    permission_denied: "You do not have permission to perform this action.",
    membership_not_found: "Staff member not found.",
    invitation_not_found: "Invite not found.",
    invitation_not_pending: "This invite is no longer pending.",
    invitation_already_pending: "An invite is already pending for this email.",
    cannot_suspend_owner: "The venue owner cannot be suspended.",
    cannot_suspend_self: "You cannot suspend your own access.",
    cannot_remove_owner: "The venue owner cannot be removed.",
    cannot_remove_self: "You cannot remove your own access.",
    cannot_edit_own_permissions: "You cannot change your own permissions.",
    cannot_edit_owner_permissions: "Owner permissions cannot be edited here.",
    last_owner_protected: "At least one active owner must remain for this venue.",
    manager_cannot_manage_role: "Managers cannot manage this role.",
    cannot_grant_permissions_not_held: "You cannot grant permissions you do not have.",
    staff_already_active: "This person is already a member of this venue.",
    cannot_manage_self_security: "Use your account settings for your own security actions.",
    invalid_password: "Incorrect password. Try again.",
    email_send_failed: "Could not send the invite email. Check Resend configuration."
  };
  return (error && map[error]) || error || "Something went wrong. Try again.";
}
