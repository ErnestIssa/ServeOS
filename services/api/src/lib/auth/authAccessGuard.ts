import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isMergedIdentityEmail,
  normalizeAuthEmail,
  normalizeAuthPhone,
  readPendingAccountCompletion
} from "./identityNormalization.js";

export type WorkspaceAuthSummary = {
  state: "none" | "active" | "pending_approval" | "suspended";
  requiresWorkspaceSelection: boolean;
  activeWorkspaceCount: number;
  pendingWorkspaceCount: number;
};

export function buildIdentityLookupWhere(input: {
  email?: string;
  phone?: string;
}): Prisma.UserWhereInput | null {
  const clauses: Prisma.UserWhereInput[] = [];
  if (input.email?.trim()) {
    clauses.push({ email: normalizeAuthEmail(input.email) });
  }
  if (input.phone?.trim()) {
    clauses.push({ phone: normalizeAuthPhone(input.phone) });
  }
  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0]! : { OR: clauses };
}

export async function assertSignupIdentityAvailable(
  prisma: PrismaClient,
  input: { email?: string; phone?: string }
): Promise<
  | { ok: true }
  | { ok: false; error: string; conflictField?: "email" | "phone" }
> {
  const email = input.email?.trim() ? normalizeAuthEmail(input.email) : undefined;
  const phone = input.phone?.trim() ? normalizeAuthPhone(input.phone) : undefined;
  if (!email && !phone) return { ok: false, error: "email_or_phone_required" };

  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true }
    });
    if (byEmail) {
      if (isMergedIdentityEmail(byEmail.email)) {
        return { ok: false, error: "account_merged" };
      }
      return { ok: false, error: "email_already_exists", conflictField: "email" };
    }
  }

  if (phone) {
    const byPhone = await prisma.user.findFirst({
      where: { phone },
      select: { id: true, email: true }
    });
    if (byPhone) {
      if (isMergedIdentityEmail(byPhone.email)) {
        return { ok: false, error: "account_merged" };
      }
      return { ok: false, error: "phone_already_exists", conflictField: "phone" };
    }
  }

  return { ok: true };
}

export async function assessWorkspaceAuthState(
  prisma: PrismaClient,
  userId: string
): Promise<WorkspaceAuthSummary> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { status: true }
  });

  const active = memberships.filter((m) => m.status === "ACTIVE");
  const pending = memberships.filter((m) => m.status === "PENDING_APPROVAL");
  const suspendedOnly =
    memberships.length > 0 &&
    memberships.every((m) => m.status === "SUSPENDED" || m.status === "REJECTED");

  if (suspendedOnly) {
    return {
      state: "suspended",
      requiresWorkspaceSelection: false,
      activeWorkspaceCount: 0,
      pendingWorkspaceCount: 0
    };
  }
  if (active.length > 0) {
    return {
      state: "active",
      requiresWorkspaceSelection: active.length > 1,
      activeWorkspaceCount: active.length,
      pendingWorkspaceCount: pending.length
    };
  }
  if (pending.length > 0) {
    return {
      state: "pending_approval",
      requiresWorkspaceSelection: pending.length > 1,
      activeWorkspaceCount: 0,
      pendingWorkspaceCount: pending.length
    };
  }
  return {
    state: "none",
    requiresWorkspaceSelection: false,
    activeWorkspaceCount: 0,
    pendingWorkspaceCount: 0
  };
}

export async function assertUserMayAuthenticate(
  prisma: PrismaClient,
  user: {
    id: string;
    email: string | null;
    signupProfile?: unknown;
  }
): Promise<{ ok: true; workspace: WorkspaceAuthSummary } | { ok: false; error: string }> {
  if (isMergedIdentityEmail(user.email)) {
    return { ok: false, error: "account_merged" };
  }

  if (readPendingAccountCompletion(user.signupProfile)) {
    return { ok: false, error: "pending_account_completion" };
  }

  const workspace = await assessWorkspaceAuthState(prisma, user.id);
  if (workspace.state === "suspended") {
    return { ok: false, error: "account_suspended" };
  }

  return { ok: true, workspace };
}

/** Per-request guard — stale sessions after suspension/merge must not access APIs. */
export async function assertBearerUserStillActive(
  prisma: PrismaClient,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, signupProfile: true }
  });
  if (!user) return { ok: false, error: "user_not_found" };
  const gate = await assertUserMayAuthenticate(prisma, user);
  if (!gate.ok) return gate;
  return { ok: true };
}

export function normalizeSignupCredentials(input: { email?: string; phone?: string }) {
  return {
    email: input.email?.trim() ? normalizeAuthEmail(input.email) : undefined,
    phone: input.phone?.trim() ? normalizeAuthPhone(input.phone) : undefined
  };
}
