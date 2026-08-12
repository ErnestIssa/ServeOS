import type { PrismaClient, Role } from "@prisma/client";

const OPERATIONAL_ROLES: Role[] = ["OWNER", "MANAGER", "STAFF", "KITCHEN", "CASHIER"];

export const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Floor staff",
  KITCHEN: "Kitchen",
  CASHIER: "Cashier"
};

function emailLocalDisplay(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) return "ServeOS user";
  return local
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function pickPersonName(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || isEmailLike(trimmed)) return null;
  return trimmed;
}

/** Identity display name — never use role or raw email as a substitute for a person's name. */
export function readUserDisplayName(input: {
  email?: string | null;
  signupProfile?: unknown;
  accountFullName?: string | null;
}): string {
  const fromAccount = pickPersonName(input.accountFullName);
  if (fromAccount) return fromAccount;

  if (input.signupProfile && typeof input.signupProfile === "object" && !Array.isArray(input.signupProfile)) {
    const root = input.signupProfile as Record<string, unknown>;
    const reg = root.registrationProfile;
    if (reg && typeof reg === "object" && !Array.isArray(reg)) {
      const contact = (reg as { contactPerson?: string }).contactPerson?.trim();
      if (contact) return contact;
      const fullName = (reg as { fullName?: string }).fullName?.trim();
      if (fullName) return fullName;
    }
    const direct = root.fullName;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const first = String(root.firstName ?? "").trim();
    const last = String(root.lastName ?? "").trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
    if (typeof root.contactPerson === "string" && root.contactPerson.trim()) {
      return root.contactPerson.trim();
    }
  }

  if (input.email?.trim()) return emailLocalDisplay(input.email.trim());
  return "ServeOS user";
}

export function membershipRoleLabel(role: Role | string): string {
  return MEMBERSHIP_ROLE_LABELS[role] ?? String(role);
}

/** Inviter shown in staff invite emails — venue membership role, not global User.role. */
export async function resolveInviterAtRestaurant(
  prisma: PrismaClient,
  params: { userId: string; restaurantId: string }
): Promise<{ name: string; roleLabel: string; membershipRole: Role | null } | null> {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        email: true,
        signupProfile: true,
        accountProfile: { select: { fullName: true } }
      }
    }),
    prisma.membership.findUnique({
      where: {
        userId_restaurantId: { userId: params.userId, restaurantId: params.restaurantId }
      },
      select: { role: true, status: true }
    })
  ]);

  if (!user) return null;

  const name = readUserDisplayName({
    email: user.email,
    signupProfile: user.signupProfile,
    accountFullName: user.accountProfile?.fullName
  });

  const membershipRole =
    membership && OPERATIONAL_ROLES.includes(membership.role) ? membership.role : null;

  const roleLabel = membershipRole ? membershipRoleLabel(membershipRole) : "Admin";

  return { name, roleLabel, membershipRole };
}
