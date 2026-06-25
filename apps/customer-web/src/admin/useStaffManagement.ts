import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  restoreStaffMembership,
  suspendStaffMembership,
  updateStaffPermissions
} from "./staffApi";
import {
  apiMemberToStaffMember,
  buildPermissionGroupsFromKeys,
  formatInviteSent,
  permissionGroupsToKeys,
  type InviteHistoryItem,
  type PendingApproval,
  type PendingInvite,
  type RecentlyRemovedMember,
  type StaffMember,
  type StaffPermissionGroup
} from "./staffMappers";

export function useStaffManagement(token: string | null, restaurantId: string, venueName: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [inviteHistory, setInviteHistory] = useState<InviteHistoryItem[]>([]);
  const [recentlyRemoved, setRecentlyRemoved] = useState<RecentlyRemovedMember[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<Array<{ id: string; label: string; keys: string[] }>>([]);

  const load = useCallback(async () => {
    if (!token || !restaurantId) {
      setStaff([]);
      setPendingInvites([]);
      setPendingApprovals([]);
      setInviteHistory([]);
      setRecentlyRemoved([]);
      setLoading(false);
      hasLoadedOnce.current = false;
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
      setPendingApprovals([]);
      setInviteHistory([]);
      setRecentlyRemoved([]);
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
        kind: "invitation" as const,
        name: inv.fullName,
        email: inv.email,
        role: inv.intendedRole as PendingInvite["role"],
        roleLabel: inv.roleLabel ?? inv.intendedRole,
        venue: venueName,
        sent: formatInviteSent(inv.createdAt),
        statusLabel: "Awaiting acceptance"
      }))
    );
    setPendingApprovals(
      (listRes.pendingApprovals ?? []).map((row) => ({
        id: row.membershipId,
        kind: "approval" as const,
        name: row.fullName ?? row.email ?? "Staff member",
        email: row.email ?? "",
        phone: row.phone ?? undefined,
        role: row.role as PendingApproval["role"],
        roleLabel: row.roleLabel ?? row.role,
        venue: venueName,
        sent: formatInviteSent(row.createdAt),
        statusLabel: "Awaiting approval",
        capabilities: row.capabilities ?? null
      }))
    );
    setInviteHistory(
      (listRes.inviteHistory ?? []).map((row) => ({
        id: row.id,
        name: row.fullName,
        email: row.email,
        phone: row.phone ?? undefined,
        role: row.intendedRole as InviteHistoryItem["role"],
        roleLabel: row.roleLabel,
        status: row.status,
        statusLabel:
          row.status === "ACCEPTED" && row.membershipStatus === "PENDING_APPROVAL"
            ? "Accepted · awaiting approval"
            : row.status === "ACCEPTED"
              ? "Accepted"
              : row.status === "PENDING"
                ? "Awaiting acceptance"
                : row.status === "CANCELLED"
                  ? "Cancelled"
                  : row.status === "EXPIRED"
                    ? "Expired"
                    : row.status,
        sent: formatInviteSent(row.createdAt),
        acceptedAt: row.acceptedAt ?? undefined,
        invitedByName: row.invitedByName,
        invitedByRole: row.invitedByRole,
        membershipId: row.membershipId,
        membershipStatus: row.membershipStatus
      }))
    );
    setRecentlyRemoved(
      (listRes.recentlyRemoved ?? []).map((row) => ({
        id: row.membershipId,
        name: row.fullName ?? row.email ?? "Staff member",
        email: row.email ?? "",
        phone: row.phone ?? undefined,
        role: row.role as RecentlyRemovedMember["role"],
        roleLabel: row.roleLabel,
        removedAt: row.removedAt ? formatInviteSent(row.removedAt) : "Recently",
        capabilities: row.capabilities ?? null
      }))
    );
    setLoading(false);
    hasLoadedOnce.current = true;
  }, [token, restaurantId, venueName]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: staff.length,
      activeToday: staff.filter((s) => s.memberStatus === "active").length,
      onShift: staff.filter((s) => s.presence === "on_shift").length,
      pending: pendingInvites.length + pendingApprovals.length
    }),
    [staff, pendingInvites, pendingApprovals]
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
      if (!res.ok) {
        return {
          ok: false as const,
          error: mapStaffApiError(res.error),
          errorCode: res.error,
          metadata: (res as { metadata?: { membershipId?: string } }).metadata
        };
      }
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
    async (action: "approve" | "suspend" | "activate" | "remove" | "restore", membershipId: string) => {
      if (!token || !restaurantId) return { ok: false as const };
      let res;
      if (action === "approve") res = await approveStaffMembership(token, restaurantId, membershipId);
      else if (action === "suspend") res = await suspendStaffMembership(token, restaurantId, membershipId);
      else if (action === "activate") res = await activateStaffMembership(token, restaurantId, membershipId);
      else if (action === "restore") res = await restoreStaffMembership(token, restaurantId, membershipId);
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
    initialLoading: loading && !hasLoadedOnce.current,
    refreshing: loading && hasLoadedOnce.current,
    error,
    staff,
    pendingInvites,
    pendingApprovals,
    inviteHistory,
    recentlyRemoved,
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
