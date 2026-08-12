import type { PrismaClient } from "@prisma/client";
import {
  planById,
  readWorkspaceDeploymentFromProfile,
  type WorkspaceDeploymentRecord,
  type WorkspacePlanId
} from "./workspaceDeploymentService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const TRIAL_NOTICE_IDS = ["welcome", "30d", "14d", "7d", "3d", "24h", "last_day"] as const;
export type TrialNoticeId = (typeof TRIAL_NOTICE_IDS)[number];

export type TrialNoticeHelpPointer = {
  label: string;
  anchor: string;
};

export type TrialNoticePayload = {
  id: TrialNoticeId;
  kind: "welcome" | "reminder";
  title: string;
  message: string;
  planName: string;
  companyName: string;
  trialStartedAt: string;
  trialEndsAt: string;
  trialDays: number;
  daysRemaining: number;
  hoursRemaining: number;
  dismissLabel: string;
  helpPointers: TrialNoticeHelpPointer[];
};

type StoredDeployment = WorkspaceDeploymentRecord & {
  trialStartedAt?: string;
  trialEndsAt?: string;
  planName?: string;
  welcomeShownAt?: string | null;
  dismissedNoticeIds?: string[];
};

function isTrialNoticeId(value: string): value is TrialNoticeId {
  return (TRIAL_NOTICE_IDS as readonly string[]).includes(value);
}

function normalizeDeployment(raw: WorkspaceDeploymentRecord): StoredDeployment {
  const started = raw.confirmedAt;
  const trialDays = raw.trialDays;
  const ends =
    (raw as StoredDeployment).trialEndsAt ??
    new Date(new Date(started).getTime() + trialDays * DAY_MS).toISOString();
  const planName =
    (raw as StoredDeployment).planName ?? planById(raw.planId as WorkspacePlanId).name;
  return {
    ...raw,
    trialStartedAt: (raw as StoredDeployment).trialStartedAt ?? started,
    trialEndsAt: ends,
    planName,
    welcomeShownAt: (raw as StoredDeployment).welcomeShownAt ?? null,
    dismissedNoticeIds: (raw as StoredDeployment).dismissedNoticeIds ?? []
  };
}

function readStoredDeployment(signupProfile: unknown): StoredDeployment | null {
  const base = readWorkspaceDeploymentFromProfile(signupProfile);
  if (!base) return null;
  return normalizeDeployment(base);
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function helpPointers(): TrialNoticeHelpPointer[] {
  return [
    { label: "Menu catalog — build your menu", anchor: "#menu-admin" },
    { label: "Live orders — track service in real time", anchor: "#orders" },
    { label: "Venue list — switch between locations", anchor: "#top" }
  ];
}

function formatTrialEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
}

function buildWelcomeNotice(deployment: StoredDeployment, companyName: string): TrialNoticePayload {
  const endsAt = deployment.trialEndsAt!;
  const daysRemaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY_MS));
  return {
    id: "welcome",
    kind: "welcome",
    title: "Your ServeOS trial is live",
    message: `${companyName} is on the ${deployment.planName} plan. Your ${deployment.trialDays}-day trial runs until ${formatTrialEndDate(endsAt)}. Use this workspace to set up your menu, connect venues, and prepare for service — we'll remind you before billing begins.`,
    planName: deployment.planName!,
    companyName,
    trialStartedAt: deployment.trialStartedAt!,
    trialEndsAt: endsAt,
    trialDays: deployment.trialDays,
    daysRemaining,
    hoursRemaining: Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / HOUR_MS)),
    dismissLabel: "Open my workspace",
    helpPointers: helpPointers()
  };
}

function buildReminderNotice(
  id: Exclude<TrialNoticeId, "welcome">,
  deployment: StoredDeployment,
  companyName: string,
  daysRemaining: number,
  hoursRemaining: number
): TrialNoticePayload {
  const planName = deployment.planName!;
  const endsAt = deployment.trialEndsAt!;
  const endLabel = formatTrialEndDate(endsAt);

  const copy: Record<Exclude<TrialNoticeId, "welcome">, { title: string; message: string }> = {
    "30d": {
      title: "One month left on your trial",
      message: `${companyName}'s ${planName} trial ends on ${endLabel}. You have about ${daysRemaining} days to finish menu setup, hardware scheduling, and staff invites before your subscription begins.`
    },
    "14d": {
      title: "Two weeks remaining",
      message: `Your ${planName} trial for ${companyName} ends in about two weeks (${endLabel}). Review your venues and orders workflow so service is ready when billing starts.`
    },
    "7d": {
      title: "One week remaining",
      message: `${companyName} has one week left on the ${planName} trial. Confirm your menu, checkout flow, and team access before ${endLabel}.`
    },
    "3d": {
      title: "Three days remaining",
      message: `Your ServeOS ${planName} trial for ${companyName} ends in three days (${endLabel}). Make any final setup changes now — billing begins automatically when the trial ends.`
    },
    "24h": {
      title: "24 hours remaining",
      message: `${companyName}'s ${planName} trial ends within 24 hours (${endLabel}). Your workspace stays active — subscription billing starts when the trial period ends unless you contact ServeOS support.`
    },
    last_day: {
      title: "Last day of your trial",
      message: `Today is the final day of ${companyName}'s ${planName} trial. Your ServeOS workspace remains available — thank you for building with us. Billing for your plan begins when the trial ends tonight.`
    }
  };

  const block = copy[id];
  return {
    id,
    kind: "reminder",
    title: block.title,
    message: block.message,
    planName,
    companyName,
    trialStartedAt: deployment.trialStartedAt!,
    trialEndsAt: endsAt,
    trialDays: deployment.trialDays,
    daysRemaining,
    hoursRemaining,
    dismissLabel: "Got it",
    helpPointers: helpPointers()
  };
}

function eligibleReminderId(
  remainingMs: number,
  trialEndsAt: Date,
  now: Date
): Exclude<TrialNoticeId, "welcome"> | null {
  if (remainingMs <= 0 || isSameUtcDay(now, trialEndsAt)) return "last_day";
  if (remainingMs <= 24 * HOUR_MS) return "24h";
  if (remainingMs <= 3 * DAY_MS) return "3d";
  if (remainingMs <= 7 * DAY_MS) return "7d";
  if (remainingMs <= 14 * DAY_MS) return "14d";
  if (remainingMs <= 30 * DAY_MS) return "30d";
  return null;
}

export async function resolveOwnerCompanyName(
  prisma: PrismaClient,
  userId: string,
  signupProfile: unknown
): Promise<string> {
  if (signupProfile && typeof signupProfile === "object" && !Array.isArray(signupProfile)) {
    const root = signupProfile as Record<string, unknown>;
    const reg = root.registrationProfile;
    if (reg && typeof reg === "object" && !Array.isArray(reg)) {
      const name = (reg as { companyName?: string }).companyName?.trim();
      if (name) return name;
    }
    const biz = root.companyName;
    if (typeof biz === "string" && biz.trim()) return biz.trim();
    const bizName = root.bizName;
    if (typeof bizName === "string" && bizName.trim()) return bizName.trim();
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, role: "OWNER" },
    include: { restaurant: { include: { company: true } } },
    orderBy: { createdAt: "asc" }
  });

  const legal = membership?.restaurant?.company?.legalName?.trim();
  if (legal) return legal;
  const venue = membership?.restaurant?.name?.trim();
  if (venue) return venue;
  return "your business";
}

export function evaluateTrialNotice(
  deployment: StoredDeployment,
  companyName: string,
  now = new Date()
): TrialNoticePayload | null {
  const dismissed = new Set(deployment.dismissedNoticeIds ?? []);
  const endsAt = new Date(deployment.trialEndsAt!);
  const remainingMs = endsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  const hoursRemaining = Math.max(0, Math.ceil(remainingMs / HOUR_MS));

  if (!deployment.welcomeShownAt && !dismissed.has("welcome")) {
    return buildWelcomeNotice(deployment, companyName);
  }

  const reminderId = eligibleReminderId(remainingMs, endsAt, now);
  if (!reminderId || dismissed.has(reminderId)) return null;

  return buildReminderNotice(reminderId, deployment, companyName, daysRemaining, hoursRemaining);
}

export async function getOwnerTrialNotice(
  prisma: PrismaClient,
  userId: string
): Promise<TrialNoticePayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupProfile: true, role: true }
  });
  if (!user || user.role !== "OWNER") return null;

  const deployment = readStoredDeployment(user.signupProfile);
  if (!deployment) return null;

  const companyName = await resolveOwnerCompanyName(prisma, userId, user.signupProfile);
  return evaluateTrialNotice(deployment, companyName);
}

export async function dismissOwnerTrialNotice(
  prisma: PrismaClient,
  userId: string,
  noticeId: string
): Promise<TrialNoticePayload | null> {
  if (!isTrialNoticeId(noticeId)) {
    throw Object.assign(new Error("invalid_notice_id"), { statusCode: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupProfile: true, role: true }
  });
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });
  if (user.role !== "OWNER") throw Object.assign(new Error("owner_only"), { statusCode: 403 });

  const deployment = readStoredDeployment(user.signupProfile);
  if (!deployment) throw Object.assign(new Error("no_deployment"), { statusCode: 404 });

  const prevProfile =
    user.signupProfile && typeof user.signupProfile === "object" && !Array.isArray(user.signupProfile)
      ? (user.signupProfile as Record<string, unknown>)
      : {};

  const dismissed = new Set(deployment.dismissedNoticeIds ?? []);
  dismissed.add(noticeId);

  const workspaceDeployment: StoredDeployment = {
    ...deployment,
    dismissedNoticeIds: [...dismissed],
    welcomeShownAt:
      noticeId === "welcome" ? new Date().toISOString() : deployment.welcomeShownAt ?? null
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      signupProfile: {
        ...prevProfile,
        workspaceDeployment
      }
    }
  });

  const companyName = await resolveOwnerCompanyName(prisma, userId, {
    ...prevProfile,
    workspaceDeployment
  });
  return evaluateTrialNotice(workspaceDeployment, companyName);
}
