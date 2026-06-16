import type { ApiPermissionGroup, ApiStaffMember } from "./staffApi";

export type StaffRole = "STAFF" | "KITCHEN" | "CASHIER" | "MANAGER" | "OWNER";
export type PresenceStatus = "on_shift" | "online" | "idle" | "offline" | "suspended" | "pending";
export type MemberStatus = "active" | "suspended" | "pending_invite" | "pending_approval";

export type StaffPermissionGroup = { id: string; label: string; enabled: boolean; keys: string[] };

export type StaffMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  roleTemplate: string;
  memberStatus: MemberStatus;
  presence: PresenceStatus;
  venues: string[];
  currentShift?: string;
  lastActive: string;
  permissionSummary: string;
  permissions: string[];
  devices: Array<{ label: string; type: string; lastSeen: string }>;
  permissionGroups: StaffPermissionGroup[];
  sessions: Array<{ device: string; location: string; lastActive: string; current: boolean }>;
};

export type PendingInvite = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  venue: string;
  sent: string;
};

function mapMemberStatus(status: string): MemberStatus {
  if (status === "SUSPENDED") return "suspended";
  if (status === "PENDING_APPROVAL") return "pending_approval";
  return "active";
}

function mapPresence(presence: string): PresenceStatus {
  if (
    presence === "on_shift" ||
    presence === "online" ||
    presence === "idle" ||
    presence === "offline" ||
    presence === "suspended" ||
    presence === "pending"
  ) {
    return presence;
  }
  return "offline";
}

export function apiMemberToStaffMember(
  m: ApiStaffMember,
  permissionGroups?: ApiPermissionGroup[]
): StaffMember {
  const groups =
    permissionGroups ??
    buildPermissionGroupsFromKeys(m.permissions);

  return {
    id: m.id,
    userId: m.userId,
    name: m.fullName,
    email: m.email ?? "",
    phone: m.phone ?? undefined,
    role: m.role as StaffRole,
    roleTemplate: m.roleTemplate,
    memberStatus: mapMemberStatus(m.status),
    presence: mapPresence(m.presence),
    venues: m.assignedLocations,
    currentShift: m.currentShift ?? undefined,
    lastActive: m.lastActiveLabel,
    permissionSummary: m.permissionSummary,
    permissions: m.permissions,
    devices: m.devices,
    permissionGroups: groups.map((g) => ({
      id: g.id,
      label: g.label,
      enabled: g.enabled,
      keys: g.keys
    })),
    sessions: m.sessions.map((s) => ({
      device: s.device,
      location: s.location,
      lastActive: s.lastActive,
      current: s.current
    }))
  };
}

export function buildPermissionGroupsFromKeys(
  permissions: string[],
  catalog?: Array<{ id: string; label: string; keys: string[] }>
): StaffPermissionGroup[] {
  const groups = catalog ?? FALLBACK_PERMISSION_GROUPS;
  return groups.map((g) => ({
    id: g.id,
    label: g.label,
    keys: g.keys,
    enabled: g.keys.some((key) => permissions.includes(key))
  }));
}

export function permissionGroupsToKeys(groups: StaffPermissionGroup[]): string[] {
  const keys = new Set<string>();
  for (const group of groups) {
    if (group.enabled) {
      for (const key of group.keys) keys.add(key);
    }
  }
  return [...keys];
}

const FALLBACK_PERMISSION_GROUPS = [
  { id: "operations", label: "Operations", keys: ["staff.assigned_orders", "admin.live_orders", "staff.reservations", "staff.tables", "staff.shift_tools"] },
  { id: "kitchen", label: "Kitchen", keys: ["staff.kitchen", "admin.kitchen_overview"] },
  { id: "payments", label: "Payments", keys: ["staff.checkout", "admin.payment_settings"] },
  { id: "content", label: "Content", keys: ["admin.menu", "admin.modifiers"] },
  { id: "management", label: "Management", keys: ["admin.dashboard", "admin.analytics", "admin.revenue"] },
  { id: "system", label: "System", keys: ["admin.staff_management", "admin.staff_invite", "admin.devices"] }
];

export function formatInviteSent(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600_000) return `${Math.max(1, Math.floor(diff / 60_000))} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} hr ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}
