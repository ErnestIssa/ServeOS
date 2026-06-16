import type { MembershipStatus, PrismaClient } from "@prisma/client";
import { getShiftClock } from "./shiftClock.js";

export type StaffPresence = "on_shift" | "online" | "idle" | "offline" | "suspended" | "pending";

const IDLE_MS = 30 * 60 * 1000;
const ONLINE_MS = 5 * 60 * 1000;

export function formatRelativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const at = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (Number.isNaN(at)) return "—";
  const diff = Date.now() - at;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} hr ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}

export function derivePresence(params: {
  membershipStatus: MembershipStatus;
  clockedIn: boolean;
  lastActiveAt: Date | null;
}): StaffPresence {
  if (params.membershipStatus === "SUSPENDED") return "suspended";
  if (params.membershipStatus === "PENDING_APPROVAL") return "pending";
  if (params.membershipStatus === "REJECTED") return "offline";
  if (params.clockedIn) return "on_shift";
  if (!params.lastActiveAt) return "offline";
  const age = Date.now() - params.lastActiveAt.getTime();
  if (age <= ONLINE_MS) return "online";
  if (age <= IDLE_MS) return "idle";
  return "offline";
}

export async function loadMemberRuntime(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string,
  membershipStatus: MembershipStatus
) {
  const [sessions, shift] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: "desc" },
      take: 8
    }),
    getShiftClock(userId, restaurantId)
  ]);

  const lastActiveAt = sessions[0]?.lastActiveAt ?? null;
  const presence = derivePresence({
    membershipStatus,
    clockedIn: shift.clockedIn,
    lastActiveAt
  });

  return {
    presence,
    lastActiveAt: lastActiveAt?.toISOString() ?? null,
    lastActiveLabel: formatRelativeTime(lastActiveAt),
    activeSessionsCount: sessions.length,
    currentShift: shift.clockedIn
      ? shift.breakStartedAt
        ? "On break"
        : shift.clockInAt
          ? `Clocked in · ${formatRelativeTime(shift.clockInAt)}`
          : "On shift"
      : null,
    sessions: sessions.map((s) => ({
      id: s.id,
      device: `${s.deviceName ?? "Device"} · ${s.browser ?? "Browser"}`,
      location: s.location ?? "—",
      lastActive: formatRelativeTime(s.lastActiveAt),
      lastActiveAt: s.lastActiveAt.toISOString(),
      current: false
    })),
    devices: sessions.slice(0, 4).map((s) => ({
      label: s.deviceName ?? "Unknown device",
      type: s.browser ?? "Session",
      lastSeen: formatRelativeTime(s.lastActiveAt)
    }))
  };
}
