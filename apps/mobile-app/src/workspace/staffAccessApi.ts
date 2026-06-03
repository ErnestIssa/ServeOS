import { apiFetch } from "../api";

export async function approveStaffMembership(jwt: string, restaurantId: string, membershipId: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/approve`,
    { method: "POST", headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function rejectStaffMembership(jwt: string, restaurantId: string, membershipId: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/memberships/${encodeURIComponent(membershipId)}/reject`,
    { method: "POST", headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function inviteStaffMember(
  jwt: string,
  restaurantId: string,
  body: {
    fullName: string;
    email: string;
    intendedRole: string;
    phone?: string;
  }
) {
  return apiFetch<{ ok: true; acceptUrl?: string } | { ok: false; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/staff/invitations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body)
    }
  );
}
