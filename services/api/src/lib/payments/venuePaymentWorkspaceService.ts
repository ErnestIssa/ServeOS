import type { PrismaClient } from "@prisma/client";
import {
  getPaymentProviderEnvReady,
  getVenuePaymentSettings,
  type VenuePaymentSettings
} from "./venuePaymentSettingsService.js";

export type PaymentDataSource = "live" | "demo";

export type PaymentHealthStatus = "operational" | "degraded" | "disabled" | "unknown";

export type PaymentOverview = {
  source: PaymentDataSource;
  currency: string;
  health: {
    paymentSystem: PaymentHealthStatus;
    onlinePayments: PaymentHealthStatus;
    payAtVenue: PaymentHealthStatus;
    refunds: PaymentHealthStatus;
    webhooks: PaymentHealthStatus;
    settlement: PaymentHealthStatus;
  };
  today: {
    paymentsCents: number;
    pendingCents: number;
    refundedCents: number;
    failedCents: number;
    payAtVenueCents: number;
    onlineCents: number;
    disputeCount: number;
    reconAlertCount: number;
  };
  providerSummary: {
    stripe: "connected" | "disconnected";
    swish: "connected" | "disconnected";
    terminalsConnected: number;
  };
};

export type PaymentActivityRange = "7d" | "30d" | "90d";

export type PaymentActivityPoint = {
  date: string;
  onlineCents: number;
  venueCents: number;
  refundedCents: number;
  failedCents: number;
};

export type PaymentActivitySeries = {
  source: PaymentDataSource;
  range: PaymentActivityRange;
  currency: string;
  points: PaymentActivityPoint[];
};

export type PaymentTxnStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded"
  | "disputed"
  | "charged_back";

export type PaymentTransactionRow = {
  id: string;
  source: PaymentDataSource;
  orderId: string | null;
  orderDisplay?: string | null;
  customerLabel: string;
  amountCents: number;
  tipCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  method: string;
  provider: string;
  status: PaymentTxnStatus;
  refundedCents: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentTimelineEvent = {
  at: string;
  type: string;
  label: string;
};

export type PaymentTransactionDetail = PaymentTransactionRow & {
  timeline: PaymentTimelineEvent[];
};

export type PaymentRefundRow = {
  id: string;
  source: PaymentDataSource;
  paymentId: string;
  orderId: string | null;
  amountCents: number;
  currency: string;
  reason: string;
  requestedBy: string;
  approvedBy: string | null;
  provider: string;
  status: "pending_approval" | "processing" | "completed" | "failed" | "partially_refunded";
  createdAt: string;
  completedAt: string | null;
};

export type PaymentReconciliation = {
  source: PaymentDataSource;
  orders: number;
  payments: number;
  matched: number;
  mismatched: number;
  pendingProviderEvents: number;
  mismatches: Array<{
    id: string;
    type: string;
    summary: string;
    orderId: string | null;
    paymentId: string | null;
    amountCents: number | null;
    createdAt: string;
  }>;
};

export type PaymentPayoutRow = {
  id: string;
  source: PaymentDataSource;
  status: "scheduled" | "in_transit" | "paid" | "failed";
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  chargebacksCents: number;
  tipsCents: number;
  netCents: number;
  currency: string;
  expectedAt: string;
  paidAt: string | null;
  provider: string;
};

export type PaymentWebhookHealth = {
  source: PaymentDataSource;
  status: "healthy" | "degraded" | "failing";
  lastEventAt: string | null;
  eventsToday: number;
  failed: number;
  retrying: number;
  recentEvents: Array<{
    id: string;
    type: string;
    at: string;
    ok: boolean;
  }>;
};

export type PaymentLogRow = {
  id: string;
  source: PaymentDataSource;
  category: "webhook" | "payment" | "refund" | "security" | "config" | "reconciliation";
  level: "info" | "warn" | "error";
  message: string;
  at: string;
  meta?: Record<string, unknown>;
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function utcDayStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function emptyActivity(range: PaymentActivityRange): PaymentActivityPoint[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const end = utcDayStart();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return {
      date: dayKey(d),
      onlineCents: 0,
      venueCents: 0,
      refundedCents: 0,
      failedCents: 0
    };
  });
}

function demoActivity(range: PaymentActivityRange): PaymentActivityPoint[] {
  return emptyActivity(range).map((p, i) => {
    const wave = (Math.sin(i / 2.4) + 1.2) * 40_000;
    const venue = Math.round(wave * 0.28);
    const online = Math.round(wave * 0.72);
    const failed = i % 9 === 0 ? 7_400 : i % 5 === 0 ? 2_200 : 0;
    const refunded = i % 7 === 0 ? 3_200 : 0;
    return { ...p, onlineCents: online, venueCents: venue, refundedCents: refunded, failedCents: failed };
  });
}

function demoTransactions(): PaymentTransactionRow[] {
  const now = Date.now();
  const rows: Array<Omit<PaymentTransactionRow, "source">> = [
    {
      id: "demo_txn_01",
      orderId: "demo_ord_01",
      orderDisplay: "#1842",
      customerLabel: "Table 12",
      amountCents: 420_00,
      tipCents: 40_00,
      feeCents: 825,
      netCents: 451_75,
      currency: "SEK",
      method: "card",
      provider: "stripe",
      status: "captured",
      refundedCents: 0,
      createdAt: new Date(now - 12 * 60_000).toISOString(),
      updatedAt: new Date(now - 11 * 60_000).toISOString()
    },
    {
      id: "demo_txn_02",
      orderId: "demo_ord_02",
      orderDisplay: "#1841",
      customerLabel: "Walk-in",
      amountCents: 186_00,
      tipCents: 0,
      feeCents: 0,
      netCents: 186_00,
      currency: "SEK",
      method: "cash",
      provider: "manual",
      status: "captured",
      refundedCents: 0,
      createdAt: new Date(now - 45 * 60_000).toISOString(),
      updatedAt: new Date(now - 45 * 60_000).toISOString()
    },
    {
      id: "demo_txn_03",
      orderId: "demo_ord_03",
      orderDisplay: "#1840",
      customerLabel: "Anna K.",
      amountCents: 890_00,
      tipCents: 90_00,
      feeCents: 1_420,
      netCents: 964_80,
      currency: "SEK",
      method: "swish",
      provider: "swish",
      status: "captured",
      refundedCents: 0,
      createdAt: new Date(now - 2 * 3600_000).toISOString(),
      updatedAt: new Date(now - 2 * 3600_000).toISOString()
    },
    {
      id: "demo_txn_04",
      orderId: "demo_ord_04",
      orderDisplay: "#1839",
      customerLabel: "QR guest",
      amountCents: 312_00,
      tipCents: 0,
      feeCents: 520,
      netCents: 0,
      currency: "SEK",
      method: "card",
      provider: "stripe",
      status: "failed",
      refundedCents: 0,
      createdAt: new Date(now - 3 * 3600_000).toISOString(),
      updatedAt: new Date(now - 3 * 3600_000).toISOString()
    },
    {
      id: "demo_txn_05",
      orderId: "demo_ord_05",
      orderDisplay: "#1838",
      customerLabel: "Table 4",
      amountCents: 640_00,
      tipCents: 0,
      feeCents: 980,
      netCents: 550_20,
      currency: "SEK",
      method: "apple_pay",
      provider: "stripe",
      status: "partially_refunded",
      refundedCents: 80_00,
      createdAt: new Date(now - 26 * 3600_000).toISOString(),
      updatedAt: new Date(now - 5 * 3600_000).toISOString()
    },
    {
      id: "demo_txn_06",
      orderId: "demo_ord_06",
      orderDisplay: "#1837",
      customerLabel: "Reservation · Berg",
      amountCents: 1_240_00,
      tipCents: 120_00,
      feeCents: 2_100,
      netCents: 1_358_00,
      currency: "SEK",
      method: "card",
      provider: "stripe",
      status: "pending",
      refundedCents: 0,
      createdAt: new Date(now - 20 * 60_000).toISOString(),
      updatedAt: new Date(now - 20 * 60_000).toISOString()
    },
    {
      id: "demo_txn_07",
      orderId: "demo_ord_07",
      orderDisplay: "#1830",
      customerLabel: "Google Pay guest",
      amountCents: 255_00,
      tipCents: 0,
      feeCents: 410,
      netCents: 250_90,
      currency: "SEK",
      method: "google_pay",
      provider: "stripe",
      status: "disputed",
      refundedCents: 0,
      createdAt: new Date(now - 4 * 86400_000).toISOString(),
      updatedAt: new Date(now - 1 * 86400_000).toISOString()
    }
  ];
  return rows.map((r) => ({ ...r, source: "demo" as const }));
}

function demoRefunds(): PaymentRefundRow[] {
  const now = Date.now();
  return [
    {
      id: "demo_ref_01",
      source: "demo",
      paymentId: "demo_txn_05",
      orderId: "demo_ord_05",
      amountCents: 80_00,
      currency: "SEK",
      reason: "Item unavailable",
      requestedBy: "Staff · Mira",
      approvedBy: "Manager · Erik",
      provider: "stripe",
      status: "completed",
      createdAt: new Date(now - 5 * 3600_000).toISOString(),
      completedAt: new Date(now - 5 * 3600_000 + 60_000).toISOString()
    },
    {
      id: "demo_ref_02",
      source: "demo",
      paymentId: "demo_txn_03",
      orderId: "demo_ord_03",
      amountCents: 90_00,
      currency: "SEK",
      reason: "Customer request",
      requestedBy: "Staff · Mira",
      approvedBy: null,
      provider: "swish",
      status: "pending_approval",
      createdAt: new Date(now - 40 * 60_000).toISOString(),
      completedAt: null
    },
    {
      id: "demo_ref_03",
      source: "demo",
      paymentId: "demo_txn_01",
      orderId: "demo_ord_01",
      amountCents: 420_00,
      currency: "SEK",
      reason: "Duplicate charge",
      requestedBy: "Manager · Erik",
      approvedBy: "Manager · Erik",
      provider: "stripe",
      status: "processing",
      createdAt: new Date(now - 8 * 60_000).toISOString(),
      completedAt: null
    }
  ];
}

function demoPayouts(): PaymentPayoutRow[] {
  const now = Date.now();
  return [
    {
      id: "demo_po_upcoming",
      source: "demo",
      status: "scheduled",
      grossCents: 1_482_000,
      feesCents: 24_200,
      refundsCents: 32_000,
      chargebacksCents: 0,
      tipsCents: 86_000,
      netCents: 1_248_000,
      currency: "SEK",
      expectedAt: new Date(now + 2 * 86400_000).toISOString(),
      paidAt: null,
      provider: "stripe"
    },
    {
      id: "demo_po_last",
      source: "demo",
      status: "paid",
      grossCents: 2_104_000,
      feesCents: 34_800,
      refundsCents: 48_000,
      chargebacksCents: 12_000,
      tipsCents: 112_000,
      netCents: 1_892_000,
      currency: "SEK",
      expectedAt: new Date(now - 2 * 86400_000).toISOString(),
      paidAt: new Date(now - 2 * 86400_000).toISOString(),
      provider: "stripe"
    }
  ];
}

function demoWebhookHealth(): PaymentWebhookHealth {
  const now = Date.now();
  return {
    source: "demo",
    status: "healthy",
    lastEventAt: new Date(now - 12_000).toISOString(),
    eventsToday: 1842,
    failed: 3,
    retrying: 1,
    recentEvents: [
      { id: "evt_1", type: "payment.succeeded", at: new Date(now - 12_000).toISOString(), ok: true },
      { id: "evt_2", type: "payment.failed", at: new Date(now - 180_000).toISOString(), ok: true },
      { id: "evt_3", type: "refund.created", at: new Date(now - 300_000).toISOString(), ok: true },
      { id: "evt_4", type: "refund.completed", at: new Date(now - 360_000).toISOString(), ok: true },
      { id: "evt_5", type: "chargeback.created", at: new Date(now - 86_400_000).toISOString(), ok: false }
    ]
  };
}

function demoLogs(settings: VenuePaymentSettings): PaymentLogRow[] {
  const now = Date.now();
  const configLogs: PaymentLogRow[] = settings.auditLog.slice(0, 8).map((a) => ({
    id: a.id,
    source: "live" as const,
    category: "config" as const,
    level: "info" as const,
    message: a.action.replace(/_/g, " "),
    at: a.at,
    meta: { path: a.path, actorRole: a.actorRole }
  }));
  const base: PaymentLogRow[] = [
    {
      id: "demo_log_1",
      source: "demo",
      category: "webhook",
      level: "info",
      message: "Webhook received · payment.succeeded",
      at: new Date(now - 12_000).toISOString()
    },
    {
      id: "demo_log_2",
      source: "demo",
      category: "payment",
      level: "info",
      message: "Payment intent created",
      at: new Date(now - 45_000).toISOString()
    },
    {
      id: "demo_log_3",
      source: "demo",
      category: "payment",
      level: "warn",
      message: "Payment authorization failed",
      at: new Date(now - 3 * 3600_000).toISOString()
    },
    {
      id: "demo_log_4",
      source: "demo",
      category: "refund",
      level: "info",
      message: "Refund requested",
      at: new Date(now - 40 * 60_000).toISOString()
    },
    {
      id: "demo_log_5",
      source: "demo",
      category: "security",
      level: "warn",
      message: "Webhook signature rejected",
      at: new Date(now - 6 * 3600_000).toISOString()
    },
    {
      id: "demo_log_6",
      source: "demo",
      category: "reconciliation",
      level: "warn",
      message: "Reconciliation mismatch detected",
      at: new Date(now - 9 * 3600_000).toISOString()
    },
    {
      id: "demo_log_7",
      source: "demo",
      category: "webhook",
      level: "info",
      message: "Duplicate event ignored",
      at: new Date(now - 10 * 3600_000).toISOString()
    }
  ];
  return [...configLogs, ...base].sort((a, b) => (a.at < b.at ? 1 : -1));
}

function mapPaymentStatus(status: string, refundedCents: number, totalCents: number): PaymentTxnStatus {
  const s = status.toUpperCase();
  if (s === "FAILED") return "failed";
  if (s === "CANCELLED" || s === "CANCELED") return "cancelled";
  if (s === "REFUNDED") return "refunded";
  if (s === "PARTIAL_REFUND" || (refundedCents > 0 && refundedCents < totalCents)) return "partially_refunded";
  if (s === "PENDING" || s === "UNPAID") return "pending";
  if (s === "AUTHORIZED") return "authorized";
  if (s === "PAID" || s === "CAPTURED" || s === "SUCCEEDED") return "captured";
  return "pending";
}

async function useDemoLedger(prisma: PrismaClient, restaurantId: string): Promise<boolean> {
  const env = getPaymentProviderEnvReady();
  if (!env.demoLedger) return false;
  const count = await prisma.orderPaymentReference.count({ where: { restaurantId } });
  return count === 0;
}

function healthFromSettings(settings: VenuePaymentSettings): PaymentOverview["health"] {
  const stripe = settings.providers.stripe.connected;
  const swish = settings.providers.swish.connected;
  const online = stripe || swish;
  return {
    paymentSystem: online || settings.methods.cash || settings.methods.payAtVenue ? "operational" : "disabled",
    onlinePayments: online ? "operational" : "disabled",
    payAtVenue: settings.payAtVenue.enabled && settings.methods.payAtVenue ? "operational" : "disabled",
    refunds: settings.refunds.manualRefund || settings.refunds.automaticRefund ? "operational" : "disabled",
    webhooks: getPaymentProviderEnvReady().webhook ? "operational" : online ? "degraded" : "unknown",
    settlement: settings.bankAccount.linked || stripe ? "operational" : "unknown"
  };
}

export async function getPaymentOverview(prisma: PrismaClient, restaurantId: string): Promise<PaymentOverview> {
  const settingsRes = await getVenuePaymentSettings(prisma, restaurantId);
  if (!settingsRes.ok) throw new Error(settingsRes.error);
  const settings = settingsRes.settings;
  const demo = await useDemoLedger(prisma, restaurantId);
  const todayStart = utcDayStart();

  if (demo) {
    return {
      source: "demo",
      currency: "SEK",
      health: healthFromSettings(settings),
      today: {
        paymentsCents: 1_842_000,
        pendingCents: 124_000,
        refundedCents: 32_000,
        failedCents: 74_000,
        payAtVenueCents: 480_000,
        onlineCents: 1_362_000,
        disputeCount: 2,
        reconAlertCount: 2
      },
      providerSummary: {
        stripe: settings.providers.stripe.connected ? "connected" : "disconnected",
        swish: settings.providers.swish.connected ? "connected" : "disconnected",
        terminalsConnected: settings.methods.cardTerminal ? 2 : 0
      }
    };
  }

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: todayStart } },
    select: {
      totalCents: true,
      refundedCents: true,
      paymentStatus: true,
      paymentReferences: { select: { provider: true, amountCents: true, status: true } }
    }
  });

  let paymentsCents = 0;
  let pendingCents = 0;
  let refundedCents = 0;
  let failedCents = 0;
  let payAtVenueCents = 0;
  let onlineCents = 0;

  for (const o of orders) {
    const status = o.paymentStatus;
    refundedCents += o.refundedCents ?? 0;
    if (status === "FAILED") failedCents += o.totalCents;
    else if (status === "PENDING" || status === "UNPAID") pendingCents += o.totalCents;
    else if (status === "PAID" || status === "PARTIAL_REFUND" || status === "REFUNDED") {
      paymentsCents += o.totalCents;
      const providers = o.paymentReferences.map((r) => r.provider.toLowerCase());
      const isOnline = providers.some((p) => p.includes("stripe") || p.includes("swish"));
      if (isOnline) onlineCents += o.totalCents;
      else payAtVenueCents += o.totalCents;
    }
  }

  return {
    source: "live",
    currency: "SEK",
    health: healthFromSettings(settings),
    today: {
      paymentsCents,
      pendingCents,
      refundedCents,
      failedCents,
      payAtVenueCents,
      onlineCents,
      disputeCount: 0,
      reconAlertCount: 0
    },
    providerSummary: {
      stripe: settings.providers.stripe.connected ? "connected" : "disconnected",
      swish: settings.providers.swish.connected ? "connected" : "disconnected",
      terminalsConnected: settings.methods.cardTerminal ? 1 : 0
    }
  };
}

export async function getPaymentActivity(
  prisma: PrismaClient,
  restaurantId: string,
  range: PaymentActivityRange
): Promise<PaymentActivitySeries> {
  const demo = await useDemoLedger(prisma, restaurantId);
  if (demo) {
    return { source: "demo", range, currency: "SEK", points: demoActivity(range) };
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const end = utcDayStart();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: start } },
    select: {
      createdAt: true,
      totalCents: true,
      refundedCents: true,
      paymentStatus: true,
      paymentReferences: { select: { provider: true } }
    }
  });

  const map = new Map(emptyActivity(range).map((p) => [p.date, { ...p }]));
  for (const o of orders) {
    const key = dayKey(utcDayStart(o.createdAt));
    const point = map.get(key);
    if (!point) continue;
    if (o.paymentStatus === "FAILED") point.failedCents += o.totalCents;
    point.refundedCents += o.refundedCents ?? 0;
    if (o.paymentStatus === "PAID" || o.paymentStatus === "PARTIAL_REFUND" || o.paymentStatus === "REFUNDED") {
      const online = o.paymentReferences.some((r) => {
        const p = r.provider.toLowerCase();
        return p.includes("stripe") || p.includes("swish");
      });
      if (online) point.onlineCents += o.totalCents;
      else point.venueCents += o.totalCents;
    }
  }

  return {
    source: "live",
    range,
    currency: "SEK",
    points: Array.from(map.values())
  };
}

export async function listPaymentTransactions(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { limit?: number }
): Promise<{ source: PaymentDataSource; transactions: PaymentTransactionRow[] }> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200);
  const demo = await useDemoLedger(prisma, restaurantId);
  if (demo) return { source: "demo", transactions: demoTransactions().slice(0, limit) };

  const refs = await prisma.orderPaymentReference.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      order: {
        select: {
          id: true,
          displaySeq: true,
          totalCents: true,
          refundedCents: true,
          paymentStatus: true
        }
      }
    }
  });

  const transactions: PaymentTransactionRow[] = refs.map((ref) => {
    const amountCents = ref.amountCents;
    const refundedCents = ref.order.refundedCents ?? 0;
    return {
      id: ref.id,
      source: "live",
      orderId: ref.order.id,
      orderDisplay: ref.order.displaySeq != null ? `#${ref.order.displaySeq}` : ref.order.id.slice(0, 8),
      customerLabel: "Guest",
      amountCents,
      tipCents: 0,
      feeCents: 0,
      netCents: Math.max(0, amountCents - refundedCents),
      currency: ref.currency || "SEK",
      method: ref.provider.toLowerCase().includes("swish")
        ? "swish"
        : ref.provider.toLowerCase().includes("cash")
          ? "cash"
          : "card",
      provider: ref.provider,
      status: mapPaymentStatus(ref.order.paymentStatus || ref.status, refundedCents, amountCents),
      refundedCents,
      createdAt: ref.createdAt.toISOString(),
      updatedAt: ref.updatedAt.toISOString()
    };
  });

  return { source: "live", transactions };
}

export async function getPaymentTransactionDetail(
  prisma: PrismaClient,
  restaurantId: string,
  transactionId: string
): Promise<PaymentTransactionDetail | null> {
  const listed = await listPaymentTransactions(prisma, restaurantId, { limit: 200 });
  const row = listed.transactions.find((t) => t.id === transactionId);
  if (!row) return null;

  const base = new Date(row.createdAt).getTime();
  const timeline: PaymentTimelineEvent[] = [
    { at: new Date(base).toISOString(), type: "initiated", label: "Payment initiated" },
    { at: new Date(base + 5_000).toISOString(), type: "authenticated", label: "Customer authenticated" }
  ];
  if (row.status === "failed") {
    timeline.push({ at: new Date(base + 12_000).toISOString(), type: "failed", label: "Payment failed" });
  } else if (row.status === "pending") {
    timeline.push({ at: new Date(base + 8_000).toISOString(), type: "pending", label: "Awaiting capture" });
  } else {
    timeline.push(
      { at: new Date(base + 8_000).toISOString(), type: "authorized", label: "Payment authorized" },
      { at: new Date(base + 12_000).toISOString(), type: "captured", label: "Payment captured" },
      { at: new Date(base + 20_000).toISOString(), type: "order_accepted", label: "Order accepted" }
    );
  }
  if (row.refundedCents > 0) {
    timeline.push(
      { at: row.updatedAt, type: "refund_requested", label: "Refund requested" },
      {
        at: row.updatedAt,
        type: "refund_completed",
        label: row.status === "refunded" ? "Refund completed" : "Partial refund completed"
      }
    );
  }
  if (row.status === "disputed" || row.status === "charged_back") {
    timeline.push({ at: row.updatedAt, type: "disputed", label: "Dispute opened" });
  }

  return { ...row, timeline };
}

export async function listPaymentRefunds(
  prisma: PrismaClient,
  restaurantId: string
): Promise<{ source: PaymentDataSource; refunds: PaymentRefundRow[] }> {
  const demo = await useDemoLedger(prisma, restaurantId);
  if (demo) return { source: "demo", refunds: demoRefunds() };

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      paymentStatus: { in: ["REFUNDED", "PARTIAL_REFUND"] },
      refundedCents: { gt: 0 }
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      displaySeq: true,
      refundedCents: true,
      updatedAt: true,
      createdAt: true,
      paymentStatus: true,
      paymentReferences: { select: { id: true, provider: true }, take: 1 }
    }
  });

  const refunds: PaymentRefundRow[] = orders.map((o) => ({
    id: `ref_${o.id}`,
    source: "live",
    paymentId: o.paymentReferences[0]?.id ?? o.id,
    orderId: o.id,
    amountCents: o.refundedCents,
    currency: "SEK",
    reason: "Refund recorded",
    requestedBy: "Staff",
    approvedBy: "Manager",
    provider: o.paymentReferences[0]?.provider ?? "unknown",
    status: o.paymentStatus === "PARTIAL_REFUND" ? "partially_refunded" : "completed",
    createdAt: o.updatedAt.toISOString(),
    completedAt: o.updatedAt.toISOString()
  }));

  return { source: "live", refunds };
}

export async function getPaymentReconciliation(
  prisma: PrismaClient,
  restaurantId: string
): Promise<PaymentReconciliation> {
  const demo = await useDemoLedger(prisma, restaurantId);
  if (demo) {
    return {
      source: "demo",
      orders: 1842,
      payments: 1841,
      matched: 1839,
      mismatched: 2,
      pendingProviderEvents: 1,
      mismatches: [
        {
          id: "mm_1",
          type: "payment_without_order",
          summary: "Provider payment with no ServeOS order",
          orderId: null,
          paymentId: "demo_orphan_01",
          amountCents: 18_500,
          createdAt: new Date(Date.now() - 3 * 3600_000).toISOString()
        },
        {
          id: "mm_2",
          type: "wrong_amount",
          summary: "Order total does not match captured payment",
          orderId: "demo_ord_05",
          paymentId: "demo_txn_05",
          amountCents: 80_00,
          createdAt: new Date(Date.now() - 6 * 3600_000).toISOString()
        }
      ]
    };
  }

  const [orderCount, paymentCount, paidOrders] = await Promise.all([
    prisma.order.count({ where: { restaurantId } }),
    prisma.orderPaymentReference.count({ where: { restaurantId } }),
    prisma.order.count({
      where: { restaurantId, paymentStatus: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] } }
    })
  ]);

  const paidWithoutRef = await prisma.order.count({
    where: {
      restaurantId,
      paymentStatus: "PAID",
      paymentReferences: { none: {} }
    }
  });

  const mismatches =
    paidWithoutRef > 0
      ? [
          {
            id: "mm_live_1",
            type: "paid_order_missing_payment",
            summary: `${paidWithoutRef} paid order(s) missing payment reference`,
            orderId: null,
            paymentId: null,
            amountCents: null,
            createdAt: new Date().toISOString()
          }
        ]
      : [];

  return {
    source: "live",
    orders: orderCount,
    payments: paymentCount,
    matched: Math.max(0, paidOrders - paidWithoutRef),
    mismatched: mismatches.length,
    pendingProviderEvents: 0,
    mismatches
  };
}

export async function listPaymentPayouts(
  prisma: PrismaClient,
  restaurantId: string
): Promise<{ source: PaymentDataSource; payouts: PaymentPayoutRow[]; summary: { upcomingCents: number; lastCents: number; currency: string } }> {
  void prisma;
  void restaurantId;
  // Payouts require Connect settlement data — always fixture-shaped until env keys exist.
  const payouts = demoPayouts();
  const upcoming = payouts.find((p) => p.status === "scheduled");
  const last = payouts.find((p) => p.status === "paid");
  return {
    source: "demo",
    payouts,
    summary: {
      upcomingCents: upcoming?.netCents ?? 0,
      lastCents: last?.netCents ?? 0,
      currency: "SEK"
    }
  };
}

export async function getPaymentWebhookHealth(
  prisma: PrismaClient,
  restaurantId: string
): Promise<PaymentWebhookHealth> {
  void prisma;
  void restaurantId;
  const env = getPaymentProviderEnvReady();
  const demo = demoWebhookHealth();
  if (!env.webhook) {
    return { ...demo, status: "degraded" };
  }
  return demo;
}

export async function listPaymentLogs(
  prisma: PrismaClient,
  restaurantId: string
): Promise<{ source: PaymentDataSource; logs: PaymentLogRow[] }> {
  const settingsRes = await getVenuePaymentSettings(prisma, restaurantId);
  if (!settingsRes.ok) return { source: "demo", logs: [] };
  const demo = await useDemoLedger(prisma, restaurantId);
  return {
    source: demo ? "demo" : "live",
    logs: demoLogs(settingsRes.settings)
  };
}
