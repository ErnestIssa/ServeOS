import type { PrismaClient } from "@prisma/client";
import { getUpstashRedis } from "@serveos/core-upstash";
import {
  getPaymentProviderEnvReady,
  getVenuePaymentSettings
} from "./venuePaymentSettingsService.js";
import {
  getPaymentReconciliation,
  getPaymentWebhookHealth
} from "./venuePaymentWorkspaceService.js";

export type PaymentOverallHealth = "healthy" | "degraded" | "critical";

export type PaymentHealthDimensionStatus = "operational" | "degraded" | "disabled" | "unknown";

export type PaymentHealthActionTarget =
  | "transactions"
  | "refunds"
  | "reconciliation"
  | "providers"
  | "logs"
  | "overview";

export type PaymentHealthIssue = {
  id: string;
  severity: "warning" | "critical";
  title: string;
  detail: string;
  actionLabel: string;
  actionTarget: PaymentHealthActionTarget;
  count?: number;
};

export type PaymentHealthChartSlice = {
  key: string;
  label: string;
  short: string;
  status: PaymentHealthDimensionStatus;
  statusLabel: string;
  value: number;
};

export type PaymentHealthHistoryPoint = {
  at: string;
  overall: PaymentOverallHealth;
  reason: string;
};

export type PaymentHealthSnapshot = {
  source: "live" | "demo";
  evaluatedAt: string;
  cached: boolean;
  cacheTtlSec: number;
  overall: PaymentOverallHealth;
  overallLabel: string;
  summary: string;
  dimensions: {
    paymentSystem: PaymentHealthDimensionStatus;
    onlinePayments: PaymentHealthDimensionStatus;
    payAtVenue: PaymentHealthDimensionStatus;
    refunds: PaymentHealthDimensionStatus;
    webhooks: PaymentHealthDimensionStatus;
    settlement: PaymentHealthDimensionStatus;
    providers: PaymentHealthDimensionStatus;
    reconciliation: PaymentHealthDimensionStatus;
  };
  chartSlices: PaymentHealthChartSlice[];
  metrics: {
    successRate24h: number;
    successRate7d: number;
    failedCount24h: number;
    failureRate24h: number;
    pendingStuckCount: number;
    refundFailedOrPending: number;
    reconciliationMismatches: number;
    webhookReceivedToday: number;
    webhookFailed: number;
    webhookDelayed: number;
    webhookRetrying: number;
  };
  providers: Array<{
    key: string;
    label: string;
    connected: boolean;
    status: PaymentHealthDimensionStatus;
    statusLabel: string;
  }>;
  timestamps: {
    lastSuccessfulPaymentAt: string | null;
    lastWebhookAt: string | null;
    lastReconciliationAt: string | null;
  };
  issues: PaymentHealthIssue[];
  incidents: Array<{
    id: string;
    at: string;
    severity: "warning" | "critical";
    title: string;
  }>;
  history: PaymentHealthHistoryPoint[];
};

const CACHE_TTL_SEC = 30;
const HISTORY_MAX = 40;
const PENDING_STUCK_MS = 30 * 60_000;
const memoryCache = new Map<string, { expiresAt: number; snapshot: PaymentHealthSnapshot }>();
const memoryHistory = new Map<string, PaymentHealthHistoryPoint[]>();

function cacheKey(restaurantId: string) {
  return `serveos:payments:health:${restaurantId}`;
}

function historyKey(restaurantId: string) {
  return `serveos:payments:health:history:${restaurantId}`;
}

function overallLabel(overall: PaymentOverallHealth) {
  if (overall === "healthy") return "Healthy";
  if (overall === "degraded") return "Degraded";
  return "Critical";
}

function dimLabel(
  key: string,
  status: PaymentHealthDimensionStatus
): string {
  if (status === "operational") {
    if (key === "payAtVenue") return "Enabled";
    if (key === "webhooks") return "Receiving";
    if (key === "settlement") return "Up to date";
    if (key === "reconciliation") return "Matched";
    return "Operational";
  }
  if (status === "degraded") return "Degraded";
  if (status === "disabled") return "Disabled";
  return "Unknown";
}

function rate(success: number, total: number) {
  if (total <= 0) return 100;
  return Math.round((success / total) * 1000) / 10;
}

async function readCache(restaurantId: string): Promise<PaymentHealthSnapshot | null> {
  const mem = memoryCache.get(restaurantId);
  if (mem && mem.expiresAt > Date.now()) {
    return { ...mem.snapshot, cached: true };
  }

  const redis = getUpstashRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(cacheKey(restaurantId));
    if (!raw) return null;
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as PaymentHealthSnapshot) : (raw as PaymentHealthSnapshot);
    return { ...parsed, cached: true };
  } catch {
    return null;
  }
}

async function writeCache(restaurantId: string, snapshot: PaymentHealthSnapshot) {
  const toStore = { ...snapshot, cached: false };
  memoryCache.set(restaurantId, {
    expiresAt: Date.now() + CACHE_TTL_SEC * 1000,
    snapshot: toStore
  });

  const redis = getUpstashRedis();
  if (!redis) return;
  try {
    await redis.set(cacheKey(restaurantId), JSON.stringify(toStore), { ex: CACHE_TTL_SEC });
  } catch {
    /* best-effort */
  }
}

async function loadHistory(restaurantId: string): Promise<PaymentHealthHistoryPoint[]> {
  const mem = memoryHistory.get(restaurantId);
  if (mem) return mem;

  const redis = getUpstashRedis();
  if (!redis) return [];
  try {
    const raw = await redis.get<string>(historyKey(restaurantId));
    if (!raw) return [];
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as PaymentHealthHistoryPoint[]) : [];
    memoryHistory.set(restaurantId, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function appendHistory(
  restaurantId: string,
  overall: PaymentOverallHealth,
  reason: string,
  previous: PaymentHealthHistoryPoint[]
): Promise<PaymentHealthHistoryPoint[]> {
  const last = previous[0];
  if (last?.overall === overall) return previous;

  const next: PaymentHealthHistoryPoint[] = [
    { at: new Date().toISOString(), overall, reason },
    ...previous
  ].slice(0, HISTORY_MAX);

  memoryHistory.set(restaurantId, next);
  const redis = getUpstashRedis();
  if (redis) {
    try {
      await redis.set(historyKey(restaurantId), JSON.stringify(next), { ex: 60 * 60 * 24 * 30 });
    } catch {
      /* best-effort */
    }
  }
  return next;
}

function demoSnapshot(now: Date, history: PaymentHealthHistoryPoint[]): PaymentHealthSnapshot {
  const dimensions = {
    paymentSystem: "operational" as const,
    onlinePayments: "operational" as const,
    payAtVenue: "operational" as const,
    refunds: "operational" as const,
    webhooks: "degraded" as const,
    settlement: "operational" as const,
    providers: "operational" as const,
    reconciliation: "degraded" as const
  };

  const chartKeys: Array<{ key: keyof typeof dimensions; label: string; short: string }> = [
    { key: "paymentSystem", label: "Payment system", short: "System" },
    { key: "onlinePayments", label: "Online payments", short: "Online" },
    { key: "payAtVenue", label: "Pay at venue", short: "Venue" },
    { key: "refunds", label: "Refunds", short: "Refunds" },
    { key: "webhooks", label: "Webhooks", short: "Webhooks" },
    { key: "settlement", label: "Settlement", short: "Settle" },
    { key: "providers", label: "Providers", short: "Providers" },
    { key: "reconciliation", label: "Reconciliation", short: "Reconcile" }
  ];

  const issues: PaymentHealthIssue[] = [
    {
      id: "demo_webhook_delay",
      severity: "warning",
      title: "12 delayed webhooks",
      detail: "Provider events are arriving outside the expected window.",
      actionLabel: "View webhook failures",
      actionTarget: "providers",
      count: 12
    },
    {
      id: "demo_recon",
      severity: "warning",
      title: "2 payment/order mismatches",
      detail: "ServeOS and the provider ledger disagree on recent settlements.",
      actionLabel: "View affected payments",
      actionTarget: "reconciliation",
      count: 2
    }
  ];

  return {
    source: "demo",
    evaluatedAt: now.toISOString(),
    cached: false,
    cacheTtlSec: CACHE_TTL_SEC,
    overall: "degraded",
    overallLabel: "Degraded",
    summary: "6 of 8 health dimensions operational — webhooks and reconciliation need attention.",
    dimensions,
    chartSlices: chartKeys.map((item) => ({
      key: item.key,
      label: item.label,
      short: item.short,
      status: dimensions[item.key],
      statusLabel: dimLabel(item.key, dimensions[item.key]),
      value: 1
    })),
    metrics: {
      successRate24h: 96.4,
      successRate7d: 97.1,
      failedCount24h: 7,
      failureRate24h: 3.6,
      pendingStuckCount: 3,
      refundFailedOrPending: 2,
      reconciliationMismatches: 2,
      webhookReceivedToday: 1842,
      webhookFailed: 3,
      webhookDelayed: 12,
      webhookRetrying: 1
    },
    providers: [
      { key: "stripe", label: "Stripe", connected: true, status: "operational", statusLabel: "Connected" },
      { key: "swish", label: "Swish", connected: true, status: "operational", statusLabel: "Connected" }
    ],
    timestamps: {
      lastSuccessfulPaymentAt: new Date(now.getTime() - 4 * 60_000).toISOString(),
      lastWebhookAt: new Date(now.getTime() - 12_000).toISOString(),
      lastReconciliationAt: new Date(now.getTime() - 18 * 60_000).toISOString()
    },
    issues,
    incidents: [
      {
        id: "inc_1",
        at: new Date(now.getTime() - 40 * 60_000).toISOString(),
        severity: "warning",
        title: "Webhook delivery delays elevated"
      },
      {
        id: "inc_2",
        at: new Date(now.getTime() - 3 * 3600_000).toISOString(),
        severity: "warning",
        title: "Reconciliation mismatch detected"
      }
    ],
    history:
      history.length > 0
        ? history
        : [
            {
              at: new Date(now.getTime() - 40 * 60_000).toISOString(),
              overall: "degraded",
              reason: "Delayed webhooks + reconciliation mismatches"
            },
            {
              at: new Date(now.getTime() - 26 * 3600_000).toISOString(),
              overall: "healthy",
              reason: "Recovered after webhook backlog cleared"
            }
          ]
  };
}

async function evaluateLive(
  prisma: PrismaClient,
  restaurantId: string,
  history: PaymentHealthHistoryPoint[]
): Promise<PaymentHealthSnapshot> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const stuckBefore = new Date(now.getTime() - PENDING_STUCK_MS);

  const settingsRes = await getVenuePaymentSettings(prisma, restaurantId);
  if (!settingsRes.ok) throw new Error(settingsRes.error);
  const settings = settingsRes.settings;
  const envReady = getPaymentProviderEnvReady();

  const [
    paid24h,
    failed24h,
    total24h,
    paid7d,
    total7d,
    stuckPending,
    refundOpen,
    lastPaid,
    lastRef,
    webhook,
    recon
  ] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, paymentStatus: "PAID", updatedAt: { gte: dayAgo } }
    }),
    prisma.order.count({
      where: { restaurantId, paymentStatus: "FAILED", updatedAt: { gte: dayAgo } }
    }),
    prisma.order.count({
      where: {
        restaurantId,
        paymentStatus: { in: ["PAID", "FAILED", "PENDING", "UNPAID", "REFUNDED", "PARTIAL_REFUND"] },
        updatedAt: { gte: dayAgo }
      }
    }),
    prisma.order.count({
      where: { restaurantId, paymentStatus: "PAID", updatedAt: { gte: weekAgo } }
    }),
    prisma.order.count({
      where: {
        restaurantId,
        paymentStatus: { in: ["PAID", "FAILED", "PENDING", "UNPAID", "REFUNDED", "PARTIAL_REFUND"] },
        updatedAt: { gte: weekAgo }
      }
    }),
    prisma.order.count({
      where: {
        restaurantId,
        paymentStatus: { in: ["PENDING", "UNPAID"] },
        updatedAt: { lte: stuckBefore }
      }
    }),
    prisma.order.count({
      where: {
        restaurantId,
        OR: [
          { paymentStatus: "PARTIAL_REFUND" },
          { paymentStatus: "REFUNDED", refundedCents: { gt: 0 }, updatedAt: { gte: dayAgo } }
        ]
      }
    }),
    prisma.order.findFirst({
      where: { restaurantId, paymentStatus: "PAID" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    }),
    prisma.orderPaymentReference.findFirst({
      where: { restaurantId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    }),
    getPaymentWebhookHealth(prisma, restaurantId),
    getPaymentReconciliation(prisma, restaurantId)
  ]);

  const successRate24h = rate(paid24h, Math.max(total24h, paid24h + failed24h));
  const successRate7d = rate(paid7d, total7d);
  const failureRate24h = rate(failed24h, Math.max(total24h, paid24h + failed24h));
  const mismatches = recon.mismatched;

  const stripeConnected = settings.providers.stripe.connected;
  const swishConnected = settings.providers.swish.connected;
  const anyOnline = stripeConnected || swishConnected;

  let webhooks: PaymentHealthDimensionStatus =
    webhook.status === "healthy" ? "operational" : webhook.status === "degraded" ? "degraded" : "disabled";
  if (!envReady.webhook && anyOnline) webhooks = "degraded";

  let providers: PaymentHealthDimensionStatus = anyOnline ? "operational" : "disabled";
  if (anyOnline && ((stripeConnected && !envReady.stripe) || (swishConnected && !envReady.swish))) {
    providers = "degraded";
  }

  let onlinePayments: PaymentHealthDimensionStatus = anyOnline ? "operational" : "disabled";
  if (failureRate24h >= 15 || successRate24h < 85) onlinePayments = "disabled";
  else if (failureRate24h >= 8 || successRate24h < 92) onlinePayments = "degraded";

  let refunds: PaymentHealthDimensionStatus =
    settings.refunds.manualRefund || settings.refunds.automaticRefund ? "operational" : "disabled";
  if (refundOpen > 10) refunds = "degraded";

  let reconciliation: PaymentHealthDimensionStatus = mismatches === 0 ? "operational" : mismatches >= 5 ? "disabled" : "degraded";
  // map disabled for recon critical-ish to degraded/disabled for dimension enum
  if (mismatches >= 5) reconciliation = "disabled";

  const payAtVenue: PaymentHealthDimensionStatus =
    settings.payAtVenue.enabled && settings.methods.payAtVenue ? "operational" : "disabled";

  const settlement: PaymentHealthDimensionStatus =
    settings.bankAccount.linked || stripeConnected ? "operational" : "unknown";

  let paymentSystem: PaymentHealthDimensionStatus =
    anyOnline || payAtVenue === "operational" || settings.methods.cash ? "operational" : "disabled";

  if (stuckPending >= 20 || mismatches >= 5 || webhook.status === "failing") {
    paymentSystem = "disabled";
  } else if (
    stuckPending > 0 ||
    mismatches > 0 ||
    webhooks === "degraded" ||
    onlinePayments === "degraded" ||
    providers === "degraded"
  ) {
    paymentSystem = "degraded";
  }

  const dimensions = {
    paymentSystem,
    onlinePayments,
    payAtVenue,
    refunds,
    webhooks,
    settlement,
    providers,
    reconciliation
  };

  const issues: PaymentHealthIssue[] = [];
  if (mismatches > 0) {
    issues.push({
      id: "recon_mismatch",
      severity: mismatches >= 5 ? "critical" : "warning",
      title: `${mismatches} payment/order mismatch${mismatches === 1 ? "" : "es"}`,
      detail: "ServeOS and provider settlement do not fully agree.",
      actionLabel: "View affected payments",
      actionTarget: "reconciliation",
      count: mismatches
    });
  }
  if (webhook.failed > 0 || webhook.retrying > 0 || webhooks === "degraded") {
    const delayed = Math.max(webhook.failed + webhook.retrying, webhook.status === "degraded" ? 1 : 0);
    issues.push({
      id: "webhook_issues",
      severity: webhook.status === "failing" ? "critical" : "warning",
      title:
        webhook.failed + webhook.retrying > 0
          ? `${webhook.failed + webhook.retrying} webhook failure${webhook.failed + webhook.retrying === 1 ? "" : "s"} / retries`
          : "Webhook delivery degraded",
      detail: "Provider events may be delayed or failing signature checks.",
      actionLabel: "View webhook failures",
      actionTarget: "providers",
      count: delayed
    });
  }
  if (stuckPending > 0) {
    issues.push({
      id: "pending_stuck",
      severity: stuckPending >= 20 ? "critical" : "warning",
      title: `${stuckPending} stuck pending payment${stuckPending === 1 ? "" : "s"}`,
      detail: "Payments exceeded the expected processing window.",
      actionLabel: "View pending payments",
      actionTarget: "transactions",
      count: stuckPending
    });
  }
  if (failureRate24h >= 8) {
    issues.push({
      id: "failure_rate",
      severity: failureRate24h >= 15 ? "critical" : "warning",
      title: `Payment failures elevated (${failureRate24h}%)`,
      detail: "Failure rate over the last 24 hours is above the healthy threshold.",
      actionLabel: "View failed payments",
      actionTarget: "transactions",
      count: failed24h
    });
  }
  if (providers === "degraded") {
    issues.push({
      id: "provider_env",
      severity: "warning",
      title: "Provider environment incomplete",
      detail: "A connected provider is missing production secrets in the server environment.",
      actionLabel: "View provider events",
      actionTarget: "providers"
    });
  }

  let overall: PaymentOverallHealth = "healthy";
  if (
    issues.some((i) => i.severity === "critical") ||
    paymentSystem === "disabled" ||
    webhook.status === "failing" ||
    mismatches >= 5
  ) {
    overall = "critical";
  } else if (issues.length > 0 || paymentSystem === "degraded") {
    overall = "degraded";
  }

  const operationalCount = Object.values(dimensions).filter((s) => s === "operational").length;
  const totalDims = Object.keys(dimensions).length;

  const chartKeys: Array<{ key: keyof typeof dimensions; label: string; short: string }> = [
    { key: "paymentSystem", label: "Payment system", short: "System" },
    { key: "onlinePayments", label: "Online payments", short: "Online" },
    { key: "payAtVenue", label: "Pay at venue", short: "Venue" },
    { key: "refunds", label: "Refunds", short: "Refunds" },
    { key: "webhooks", label: "Webhooks", short: "Webhooks" },
    { key: "settlement", label: "Settlement", short: "Settle" },
    { key: "providers", label: "Providers", short: "Providers" },
    { key: "reconciliation", label: "Reconciliation", short: "Reconcile" }
  ];

  const reason =
    overall === "healthy"
      ? "All monitored payment signals within thresholds"
      : issues.map((i) => i.title).slice(0, 2).join(" · ") || "Elevated payment risk";

  const nextHistory = await appendHistory(restaurantId, overall, reason, history);

  return {
    source: "live",
    evaluatedAt: now.toISOString(),
    cached: false,
    cacheTtlSec: CACHE_TTL_SEC,
    overall,
    overallLabel: overallLabel(overall),
    summary:
      overall === "healthy"
        ? "All systems operational"
        : `${operationalCount} of ${totalDims} health dimensions operational — review open issues.`,
    dimensions,
    chartSlices: chartKeys.map((item) => ({
      key: item.key,
      label: item.label,
      short: item.short,
      status: dimensions[item.key],
      statusLabel: dimLabel(item.key, dimensions[item.key]),
      value: 1
    })),
    metrics: {
      successRate24h,
      successRate7d,
      failedCount24h: failed24h,
      failureRate24h,
      pendingStuckCount: stuckPending,
      refundFailedOrPending: refundOpen,
      reconciliationMismatches: mismatches,
      webhookReceivedToday: webhook.eventsToday,
      webhookFailed: webhook.failed,
      webhookDelayed: Math.max(0, webhook.failed),
      webhookRetrying: webhook.retrying
    },
    providers: [
      {
        key: "stripe",
        label: "Stripe",
        connected: stripeConnected,
        status: stripeConnected ? (envReady.stripe ? "operational" : "degraded") : "disabled",
        statusLabel: stripeConnected ? (envReady.stripe ? "Connected" : "Sandbox") : "Not connected"
      },
      {
        key: "swish",
        label: "Swish",
        connected: swishConnected,
        status: swishConnected ? (envReady.swish ? "operational" : "degraded") : "disabled",
        statusLabel: swishConnected ? (envReady.swish ? "Connected" : "Sandbox") : "Not connected"
      }
    ],
    timestamps: {
      lastSuccessfulPaymentAt: lastPaid?.updatedAt.toISOString() ?? null,
      lastWebhookAt: webhook.lastEventAt,
      lastReconciliationAt: now.toISOString()
    },
    issues,
    incidents: issues.slice(0, 5).map((issue, i) => ({
      id: `inc_${issue.id}`,
      at: new Date(now.getTime() - (i + 1) * 15 * 60_000).toISOString(),
      severity: issue.severity,
      title: issue.title
    })),
    history: nextHistory
  };
}

export async function getPaymentHealthSnapshot(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { forceRefresh?: boolean }
): Promise<PaymentHealthSnapshot> {
  if (!opts?.forceRefresh) {
    const cached = await readCache(restaurantId);
    if (cached) return cached;
  }

  const history = await loadHistory(restaurantId);
  const refCount = await prisma.orderPaymentReference.count({ where: { restaurantId } });
  const demoLedger = process.env.PAYMENT_DEMO_LEDGER !== "false" && refCount === 0;

  let snapshot: PaymentHealthSnapshot;
  if (demoLedger) {
    const demo = demoSnapshot(new Date(), history);
    const nextHistory = await appendHistory(
      restaurantId,
      demo.overall,
      demo.issues.map((i) => i.title).slice(0, 2).join(" · ") || "Demo health state",
      history
    );
    snapshot = { ...demo, history: nextHistory };
  } else {
    snapshot = await evaluateLive(prisma, restaurantId, history);
  }

  await writeCache(restaurantId, snapshot);
  return snapshot;
}
