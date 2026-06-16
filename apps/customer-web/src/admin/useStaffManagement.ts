import { useCallback, useEffect, useMemo, useState } from "react";
import {
  activateStaffMembership,
  adminResetStaffPassword,
  adminRevokeStaffSessions,
  approveStaffMembership,
  cancelStaffInvitation,
  createStaffInvitation,
  fetchStaffMemberDetail,
  fetchStaffPermissionCatalog,
  fetchVenueStaff,
  mapStaffApiError,
  removeStaffMembership,
  suspendStaffMembership,
  updateStaffPermissions
} from "./staffApi";
import {
  apiMemberToStaffMember,
  buildPermissionGroupsFromKeys,
  formatInviteSent,
  permissionGroupsToKeys,
  type PendingInvite,
  type StaffMember,
  type StaffPermissionGroup
} from "./staffMappers";

export function useStaffManagement(token: string | null, restaurantId: string, venueName: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<Array<{ id: string; label: string; keys: string[] }>>([]);

  const load = useCallback(async () => {
    if (!token || !restaurantId) {
      setStaff([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [listRes, catalogRes] = await Promise.all([
      fetchVenueStaff(token, restaurantId),
      fetchStaffPermissionCatalog(token)
    ]);
    if (!listRes.ok) {
      setError(mapStaffApiError(listRes.error));
      setStaff([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }
    const catalog = catalogRes.ok ? catalogRes.groups : [];
    setPermissionCatalog(catalog);
    setStaff(
      (listRes.members ?? []).map((m) => apiMemberToStaffMember(m, buildPermissionGroupsFromKeys(m.permissions, catalog)))
    );
    setPendingInvites(
      (listRes.pendingInvitations ?? []).map((inv) => ({
        id: inv.id,
        name: inv.fullName,
        email: inv.email,
        role: inv.intendedRole as PendingInvite["role"],
        venue: venueName,
        sent: formatInviteSent(inv.createdAt)
      }))
    );
    setLoading(false);
  }, [token, restaurantId, venueName]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: staff.length,
      activeToday: staff.filter((s) => s.memberStatus === "active").length,
      onShift: staff.filter((s) => s.presence === "on_shift").length,
      pending: pendingInvites.length + staff.filter((s) => s.memberStatus === "pending_approval").length
    }),
    [staff, pendingInvites]
  );

  const loadMemberDetail = useCallback(
    async (membershipId: string): Promise<StaffMember | null> => {
      if (!token || !restaurantId) return null;
      const res = await fetchStaffMemberDetail(token, restaurantId, membershipId);
      if (!res.ok || !res.member) return null;
      return apiMemberToStaffMember(res.member, res.permissionGroups);
    },
    [token, restaurantId]
  );

  const sendInvite = useCallback(
    async (input: { fullName: string; email: string; phone?: string; role: string }) => {
      if (!token || !restaurantId) return { ok: false as const, error: "Not signed in." };
      const res = await createStaffInvitation(token, restaurantId, {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        intendedRole: input.role
      });
      if (!res.ok) return { ok: false as const, error: mapStaffApiError(res.error) };
      await load();
      return { ok: true as const };
    },
    [token, restaurantId, load]
  );

  const cancelInvite = useCallback(
    async (invitationId: string) => {
      if (!token || !restaurantId) return { ok: false as const };
      const res = await cancelStaffInvitation(token, restaurantId, invitationId);
      if (res.ok) await load();
      return res;
    },
    [token, restaurantId, load]
  );

  const savePermissions = useCallback(
    async (membershipId: string, groups: StaffPermissionGroup[]) => {
      if (!token || !restaurantId) return { ok: false as const, error: "Not signed in." };
      const res = await updateStaffPermissions(token, restaurantId, membershipId, permissionGroupsToKeys(groups));
      if (!res.ok) return { ok: false as const, error: mapStaffApiError(res.error) };
      await load();
      return { ok: true as const };
    },
    [token, restaurantId, load]
  );

  const runMembershipAction = useCallback(
    async (action: "approve" | "suspend" | "activate" | "remove", membershipId: string) => {
      if (!token || !restaurantId) return { ok: false as const };
      let res;
      if (action === "approve") res = await approveStaffMembership(token, restaurantId, membershipId);
      else if (action === "suspend") res = await suspendStaffMembership(token, restaurantId, membershipId);
      else if (action === "activate") res = await activateStaffMembership(token, restaurantId, membershipId);
      else res = await removeStaffMembership(token, restaurantId, membershipId);
      if (res.ok) await load();
      return { ok: res.ok, error: res.ok ? undefined : mapStaffApiError(res.error) };
    },
    [token, restaurantId, load]
  );

  const runSecurityAction = useCallback(
    async (
      membershipId: string,
      action: "reset_password" | "force_logout" | "revoke_sessions",
      password: string
    ) => {
      if (!token || !restaurantId) return { ok: false as const, error: "Not signed in." };
      const res =
        action === "reset_password"
          ? await adminResetStaffPassword(token, restaurantId, membershipId, password)
          : await adminRevokeStaffSessions(token, restaurantId, membershipId, password);
      if (!res.ok) return { ok: false as const, error: mapStaffApiError(res.error) };
      if (action !== "reset_password") await load();
      return { ok: true as const };
    },
    [token, restaurantId, load]
  );

  return {
    loading,
    error,
    staff,
    pendingInvites,
    permissionCatalog,
    stats,
    reload: load,
    loadMemberDetail,
    sendInvite,
    cancelInvite,
    savePermissions,
    runMembershipAction,
    runSecurityAction
  };
}
