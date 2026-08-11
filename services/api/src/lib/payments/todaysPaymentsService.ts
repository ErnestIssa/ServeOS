import type { PrismaClient } from "@prisma/client";
import {
  getPaymentProviderEnvReady,
  getVenuePaymentSettings,
  type VenuePaymentSettings
} from "./venuePaymentSettingsService.js";
import {
  buildTodayAnalysis,
  listPaymentTransactions,
  type PaymentDataSource,
  type PaymentOverviewAnalysis,
  type PaymentTransactionRow,
  type PaymentTxnStatus
} from "./venuePaymentWorkspaceService.js";

const DEFAULT_VENUE_TIMEZONE = "Europe/Stockholm";

export type TodaysPaymentsDrillTarget = "transactions" | "refunds";

export type TodaysPaymentsDrillFilter = {
  target: TodaysPaymentsDrillTarget;
  /** Exact ledger row ids when present — UI should prefer these. */
  ids: string[];
  statuses?: PaymentTxnStatus[];
  methods?: string[];
  /** Venue-local day key (YYYY-MM-DD). */
  day: string;
  dayStart?: string;
  dayEnd?: string;
  searchPreset?: string;
};

export type TodaysPaymentsMetric = {
  key: string;
  label: string;
  valueLabel: string;
  amountCents?: number;
  count?: number;
  currency: string;
  filter: TodaysPaymentsDrillFilter;
};

export type TodaysPaymentsMethodSlice = {
  key: string;
  label: string;
  amountCents: number;
  count: number;
  currency: string;
  sharePercent: number;
  enabled: boolean;
  filter: TodaysPaymentsDrillFilter;
};

export type TodaysPaymentsSnapshot = {
  source: PaymentDataSource;
  timezone: string;
  dayKey: string;
  dayStart: string;
  dayEnd: string;
  currency: string;
  currencies: string[];
  aggregates: {
    collectedCents: number;
    successfulCount: number;
    averagePaymentCents: number;
    failedCents: number;
    failedCount: number;
    refundedCents: number;
    refundedCount: number;
    pendingCents: number;
    pendingCount: number;
  };
  analysis: PaymentOverviewAnalysis;
  metrics: TodaysPaymentsMetric[];
  methods: TodaysPaymentsMethodSlice[];
  recent: PaymentTransactionRow[];
  /** Full today’s ledger rows (capped) for reconciliation / drill-down. */
  ledger: PaymentTransactionRow[];
  /** SSOT handoff into Transactions for this venue day. */
  transactionsView: {
    label: string;
    day: string;
    dayStart: string;
    dayEnd: string;
    searchPreset: string;
    filter: TodaysPaymentsDrillFilter;
  };
};

function getZonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second)
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
function wallTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(utc, timeZone);
    const asLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = wanted - asLocal;
    if (delta === 0) break;
    utc.setTime(utc.getTime() + delta);
  }
  return utc;
}

function venueDayBounds(timeZone: string, now = new Date()) {
  const parts = getZonedParts(now, timeZone);
  const dayStart = wallTimeToUtc(timeZone, parts.year, parts.month, parts.day, 0, 0, 0);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const dayEnd = wallTimeToUtc(
    timeZone,
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0
  );
  const dayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return { dayStart, dayEnd, dayKey, parts };
}

async function resolveVenueTimezone(prisma: PrismaClient, restaurantId: string): Promise<string> {
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { paymentSettings: true }
  });
  const settings = (row?.paymentSettings ?? null) as Record<string, unknown> | null;
  const direct = settings?.timezone;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const business = settings?.business as Record<string, unknown> | undefined;
  if (typeof business?.timezone === "string" && business.timezone.trim()) return business.timezone.trim();
  return DEFAULT_VENUE_TIMEZONE;
}

function mapPaymentStatus(status: string, refundedCents: number, totalCents: number): PaymentTxnStatus {
  const s = status.toUpperCase();
  if (s === "FAILED") return "failed";
  if (s === "CANCELLED" || s === "CANCELED" || s === "VOIDED" || s === "VOID") return "cancelled";
  if (s === "REFUNDED") return "refunded";
  if (s === "PARTIAL_REFUND" || (refundedCents > 0 && refundedCents < totalCents)) return "partially_refunded";
  if (s === "PENDING" || s === "UNPAID") return "pending";
  if (s === "AUTHORIZED") return "authorized";
  if (s === "PAID" || s === "CAPTURED" || s === "SUCCEEDED") return "captured";
  return "pending";
}

function normalizeMethodKey(method: string, provider: string): string {
  const m = method.toLowerCase();
  const p = provider.toLowerCase();
  if (m.includes("swish") || p.includes("swish")) return "swish";
  if (m.includes("apple")) return "apple_pay";
  if (m.includes("google")) return "google_pay";
  if (m.includes("terminal")) return "card_terminal";
  if (m.includes("cash") || m.includes("pay_at_venue") || m.includes("payatvenue") || p === "manual") {
    return "pay_at_venue";
  }
  return "card";
}

function methodLabel(key: string) {
  switch (key) {
    case "swish":
      return "Swish";
    case "apple_pay":
      return "Apple Pay";
    case "google_pay":
      return "Google Pay";
    case "card_terminal":
      return "Card terminal";
    case "pay_at_venue":
      return "Cash / pay at venue";
    default:
      return "Card";
  }
}

/** Money that successfully cleared (includes later refunds). Excludes failed/voided/pending. */
function isSuccessfulStatus(status: PaymentTxnStatus) {
  return status === "captured" || status === "authorized" || status === "partially_refunded" || status === "refunded";
}

/**
 * Counts toward “collected today” revenue once actually paid.
 * Authorized-only holds are excluded until capture; failed/voided never count.
 */
function isCollectedStatus(status: PaymentTxnStatus) {
  return status === "captured" || status === "partially_refunded" || status === "refunded";
}

function collectedNetCents(row: PaymentTransactionRow) {
  // Prefer ledger net when present (split/partial safe); never count negative take.
  if (typeof row.netCents === "number") return Math.max(0, row.netCents);
  return Math.max(0, row.amountCents - Math.max(0, row.refundedCents));
}

function isFailedStatus(status: PaymentTxnStatus) {
  return status === "failed" || status === "cancelled";
}

function isPendingStatus(status: PaymentTxnStatus) {
  return status === "pending" || status === "authorized";
}

function isRefundActivity(status: PaymentTxnStatus, refundedCents: number) {
  return refundedCents > 0 || status === "refunded" || status === "partially_refunded";
}

function formatMoneyLabel(cents: number, currency: string) {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("sv-SE")} ${currency}`;
  }
}

function inDay(iso: string, dayStart: Date, dayEnd: Date) {
  const t = new Date(iso).getTime();
  return t >= dayStart.getTime() && t < dayEnd.getTime();
}

async function useDemoLedger(prisma: PrismaClient, restaurantId: string): Promise<boolean> {
  const env = getPaymentProviderEnvReady();
  if (!env.demoLedger) return false;
  const count = await prisma.orderPaymentReference.count({ where: { restaurantId } });
  return count === 0;
}

function refToRow(ref: {
  id: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    displaySeq: number | null;
    totalCents: number;
    refundedCents: number | null;
    paymentStatus: string;
    customerName?: string | null;
    tableLabel?: string | null;
  };
}): PaymentTransactionRow {
  const amountCents = ref.amountCents;
  const orderRefunded = ref.order.refundedCents ?? 0;
  // Attribute order-level refunds across payment refs by share of order total (split-safe).
  const orderTotal = Math.max(ref.order.totalCents, 1);
  const refundedCents = Math.min(
    amountCents,
    Math.round((orderRefunded * amountCents) / orderTotal)
  );
  const provider = ref.provider;
  const method = normalizeMethodKey(
    provider.toLowerCase().includes("swish")
      ? "swish"
      : provider.toLowerCase().includes("cash")
        ? "cash"
        : "card",
    provider
  );
  return {
    id: ref.id,
    source: "live",
    orderId: ref.order.id,
    orderDisplay: ref.order.displaySeq != null ? `#${ref.order.displaySeq}` : ref.order.id.slice(0, 8),
    customerLabel: ref.order.tableLabel || ref.order.customerName || "Guest",
    amountCents,
    tipCents: 0,
    feeCents: 0,
    netCents: Math.max(0, amountCents - refundedCents),
    currency: ref.currency || "SEK",
    method,
    provider,
    status: mapPaymentStatus(ref.order.paymentStatus || ref.status, orderRefunded, amountCents),
    refundedCents,
    createdAt: ref.createdAt.toISOString(),
    updatedAt: ref.updatedAt.toISOString()
  };
}

function enabledVenueMethods(settings: VenuePaymentSettings): Array<{ key: string; label: string }> {
  const rows: Array<{ key: string; label: string }> = [];
  const m = settings.methods;
  const push = (enabled: boolean | undefined, key: string, label?: string) => {
    if (!enabled) return;
    rows.push({ key, label: label ?? methodLabel(key) });
  };

  push(m.swish, "swish");
  push(m.visa, "visa", "Visa");
  push(m.mastercard, "mastercard", "Mastercard");
  push(m.amex, "amex", "American Express");
  push(m.applePay, "apple_pay", methodLabel("apple_pay"));
  push(m.googlePay, "google_pay", methodLabel("google_pay"));
  push(m.samsungPay, "samsung_pay", "Samsung Pay");
  push(m.klarnaPayNow, "klarna_pay_now", "Klarna — Pay now");
  push(m.klarnaPayLater, "klarna_pay_later", "Klarna — Pay later");
  push(m.klarnaInstallments, "klarna_installments", "Klarna — Installments");
  push(m.card, "card");
  push(m.cardTerminal, "card_terminal", methodLabel("card_terminal"));
  push(m.cash || m.payAtVenue, "pay_at_venue", methodLabel("pay_at_venue"));
  push(m.swishAtVenue, "swish_at_venue", "Swish (venue)");
  push(m.applePayTerminal, "apple_pay_terminal", "Apple Pay at terminal");
  push(m.googlePayTerminal, "google_pay_terminal", "Google Pay at terminal");
  push(m.samsungPayTerminal, "samsung_pay_terminal", "Samsung Pay at terminal");
  push(m.giftCards, "gift_cards", "Gift cards");
  push(m.invoice, "invoice", "Invoice");
  push(m.eInvoice, "e_invoice", "E-invoice");
  push(m.bankTransfer, "bank_transfer", "Bank transfer");
  push(m.bankgiro, "bankgiro", "Bankgiro");
  push(m.plusgiro, "plusgiro", "PlusGiro");
  push(m.loyaltyBalance, "loyalty_balance", "Loyalty balance");
  return rows;
}

function aggregateLedger(
  ledger: PaymentTransactionRow[],
  source: PaymentDataSource,
  timezone: string,
  dayKey: string,
  dayStart: Date,
  dayEnd: Date,
  analysis: PaymentOverviewAnalysis,
  enabledMethods: Array<{ key: string; label: string }>
): TodaysPaymentsSnapshot {
  const seen = new Set<string>();
  const unique: PaymentTransactionRow[] = [];
  for (const row of ledger) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }

  const collectedRows = unique.filter((r) => isCollectedStatus(r.status));
  const successfulRows = unique.filter((r) => isSuccessfulStatus(r.status));
  const failedRows = unique.filter((r) => isFailedStatus(r.status));
  const pendingRows = unique.filter((r) => isPendingStatus(r.status));
  const refundedRows = unique.filter((r) => isRefundActivity(r.status, r.refundedCents));

  // Collected excludes failed/voided; refunds are deducted (net take). Refunded amount is also shown separately.
  const collectedCents = collectedRows.reduce((sum, r) => sum + collectedNetCents(r), 0);
  const successfulCount = successfulRows.length;
  const averagePaymentCents =
    successfulCount > 0
      ? Math.round(successfulRows.reduce((sum, r) => sum + r.amountCents, 0) / successfulCount)
      : 0;
  const failedCents = failedRows.reduce((sum, r) => sum + r.amountCents, 0);
  const pendingCents = pendingRows.reduce((sum, r) => sum + r.amountCents, 0);
  const refundedCents = refundedRows.reduce((sum, r) => sum + Math.max(0, r.refundedCents), 0);

  const currencies = Array.from(new Set(unique.map((r) => r.currency || "SEK")));
  const currency = currencies[0] ?? "SEK";

  const methodMap = new Map<string, { amountCents: number; count: number; ids: string[]; currency: string }>();
  for (const row of collectedRows) {
    const key = normalizeMethodKey(row.method, row.provider);
    const cur = methodMap.get(key) ?? { amountCents: 0, count: 0, ids: [], currency: row.currency };
    cur.amountCents += collectedNetCents(row);
    cur.count += 1;
    cur.ids.push(row.id);
    methodMap.set(key, cur);
  }

  const catalog =
    enabledMethods.length > 0
      ? enabledMethods
      : Array.from(methodMap.keys()).map((key) => ({ key, label: methodLabel(key) }));

  const methods: TodaysPaymentsMethodSlice[] = catalog
    .map(({ key, label }) => {
      const v = methodMap.get(key) ?? { amountCents: 0, count: 0, ids: [] as string[], currency };
      return {
        key,
        label,
        amountCents: v.amountCents,
        count: v.count,
        currency: v.currency,
        sharePercent: collectedCents > 0 ? Math.round((v.amountCents / collectedCents) * 1000) / 10 : 0,
        enabled: true,
        filter: {
          target: "transactions" as const,
          ids: v.ids,
          methods: [key],
          day: dayKey,
          dayStart: dayStart.toISOString(),
          dayEnd: dayEnd.toISOString(),
          searchPreset: dayKey
        }
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label));

  const filterBase = {
    day: dayKey,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    searchPreset: dayKey
  };
  const metrics: TodaysPaymentsMetric[] = [
    {
      key: "collected",
      label: "Collected today",
      valueLabel: formatMoneyLabel(collectedCents, currency),
      amountCents: collectedCents,
      count: collectedRows.length,
      currency,
      filter: {
        ...filterBase,
        target: "transactions",
        ids: collectedRows.map((r) => r.id),
        statuses: ["captured", "partially_refunded", "refunded"]
      }
    },
    {
      key: "successful",
      label: "Successful payments",
      valueLabel: String(successfulCount),
      count: successfulCount,
      currency,
      filter: {
        ...filterBase,
        target: "transactions",
        ids: successfulRows.map((r) => r.id),
        statuses: ["captured", "authorized", "partially_refunded", "refunded"]
      }
    },
    {
      key: "average",
      label: "Average payment",
      valueLabel: formatMoneyLabel(averagePaymentCents, currency),
      amountCents: averagePaymentCents,
      count: successfulCount,
      currency,
      filter: {
        ...filterBase,
        target: "transactions",
        ids: successfulRows.map((r) => r.id),
        statuses: ["captured", "authorized", "partially_refunded", "refunded"]
      }
    },
    {
      key: "failed",
      label: "Failed payments",
      valueLabel: `${failedRows.length}`,
      amountCents: failedCents,
      count: failedRows.length,
      currency,
      filter: {
        ...filterBase,
        target: "transactions",
        ids: failedRows.map((r) => r.id),
        statuses: ["failed", "cancelled"]
      }
    },
    {
      key: "refunded",
      label: "Refunded amount",
      valueLabel: formatMoneyLabel(refundedCents, currency),
      amountCents: refundedCents,
      count: refundedRows.length,
      currency,
      filter: {
        ...filterBase,
        target: "transactions",
        ids: refundedRows.map((r) => r.id),
        statuses: ["partially_refunded", "refunded"]
      }
    },
    {
      key: "pending",
      label: "Pending payments",
      valueLabel: formatMoneyLabel(pendingCents, currency),
      amountCents: pendingCents,
      count: pendingRows.length,
      currency,
      filter: {
        ...filterBase,
        target: "transactions",
        ids: pendingRows.map((r) => r.id),
        statuses: ["pending", "authorized"]
      }
    }
  ];

  const recent = unique
    .filter(
      (r) =>
        isSuccessfulStatus(r.status) || isFailedStatus(r.status) || isRefundActivity(r.status, r.refundedCents)
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8);

  const ledgerSorted = unique.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 200);

  return {
    source,
    timezone,
    dayKey,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    currency,
    currencies,
    aggregates: {
      collectedCents,
      successfulCount,
      averagePaymentCents,
      failedCents,
      failedCount: failedRows.length,
      refundedCents,
      refundedCount: refundedRows.length,
      pendingCents,
      pendingCount: pendingRows.length
    },
    analysis,
    metrics,
    methods,
    recent,
    ledger: ledgerSorted,
    transactionsView: {
      label: "View today’s payments",
      day: dayKey,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      searchPreset: dayKey,
      filter: {
        target: "transactions",
        ids: ledgerSorted.map((r) => r.id),
        day: dayKey,
        dayStart: dayStart.toISOString(),
        dayEnd: dayEnd.toISOString(),
        searchPreset: dayKey
      }
    }
  };
}

export async function getTodaysPayments(
  prisma: PrismaClient,
  restaurantId: string
): Promise<TodaysPaymentsSnapshot> {
  const settingsRes = await getVenuePaymentSettings(prisma, restaurantId);
  if (!settingsRes.ok) throw new Error(settingsRes.error);
  const settings = settingsRes.settings;
  const enabledMethods = enabledVenueMethods(settings);

  const timezone = await resolveVenueTimezone(prisma, restaurantId);
  const now = new Date();
  const { dayStart, dayEnd, dayKey } = venueDayBounds(timezone, now);
  const yesterdayParts = getZonedParts(new Date(dayStart.getTime() - 60_000), timezone);
  const yesterdayStart = wallTimeToUtc(
    timezone,
    yesterdayParts.year,
    yesterdayParts.month,
    yesterdayParts.day,
    0,
    0,
    0
  );
  const elapsedMs = Math.max(0, now.getTime() - dayStart.getTime());
  const yesterdaySameTimeEnd = new Date(yesterdayStart.getTime() + elapsedMs);

  const demo = await useDemoLedger(prisma, restaurantId);

  if (demo) {
    const listed = await listPaymentTransactions(prisma, restaurantId, { limit: 200 });
    // Treat demo rows from the last ~18h as “today” so the panel has activity.
    const todayLedger = listed.transactions
      .filter((t) => inDay(t.createdAt, new Date(now.getTime() - 18 * 3600_000), dayEnd))
      .map((t) => ({ ...t, method: normalizeMethodKey(t.method, t.provider) }));

    // Ensure a refunded-today signal for demo UX.
    if (!todayLedger.some((t) => t.refundedCents > 0)) {
      todayLedger.push({
        id: "demo_txn_today_refund",
        source: "demo",
        orderId: "demo_ord_today_refund",
        orderDisplay: "#1843",
        customerLabel: "Table 7",
        amountCents: 320_00,
        tipCents: 0,
        feeCents: 480,
        netCents: 240_00,
        currency: "SEK",
        method: "card",
        provider: "stripe",
        status: "partially_refunded",
        refundedCents: 80_00,
        createdAt: new Date(now - 90 * 60_000).toISOString(),
        updatedAt: new Date(now - 80 * 60_000).toISOString()
      });
    }

    const collectedCents = todayLedger
      .filter((r) => isCollectedStatus(r.status))
      .reduce((s, r) => s + collectedNetCents(r), 0);
    const analysis = buildTodayAnalysis(collectedCents, Math.round(collectedCents * 0.88), Math.round(collectedCents * 1.18));

    return aggregateLedger(todayLedger, "demo", timezone, dayKey, dayStart, dayEnd, analysis, enabledMethods);
  }

  const refs = await prisma.orderPaymentReference.findMany({
    where: {
      restaurantId,
      createdAt: { gte: dayStart, lt: dayEnd }
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      order: {
        select: {
          id: true,
          displaySeq: true,
          totalCents: true,
          refundedCents: true,
          paymentStatus: true,
          customerName: true,
          tableLabel: true
        }
      }
    }
  });

  // Deduplicate webhook retries / duplicate provider events via unique provider+externalId already in DB;
  // also guard by id in aggregateLedger.
  const ledger = refs.map((ref) => refToRow(ref));

  // Cash/pay-at-venue with no payment reference: include paid orders in-window with no refs.
  const paidOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      createdAt: { gte: dayStart, lt: dayEnd },
      paymentStatus: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] },
      paymentReferences: { none: {} }
    },
    select: {
      id: true,
      displaySeq: true,
      totalCents: true,
      refundedCents: true,
      paymentStatus: true,
      customerName: true,
      tableLabel: true,
      createdAt: true,
      updatedAt: true
    },
    take: 200
  });

  for (const order of paidOrders) {
    ledger.push({
      id: `order_paid_${order.id}`,
      source: "live",
      orderId: order.id,
      orderDisplay: order.displaySeq != null ? `#${order.displaySeq}` : order.id.slice(0, 8),
      customerLabel: order.tableLabel || order.customerName || "Guest",
      amountCents: order.totalCents,
      tipCents: 0,
      feeCents: 0,
      netCents: Math.max(0, order.totalCents - (order.refundedCents ?? 0)),
      currency: "SEK",
      method: "pay_at_venue",
      provider: "manual",
      status: mapPaymentStatus(order.paymentStatus, order.refundedCents ?? 0, order.totalCents),
      refundedCents: order.refundedCents ?? 0,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    });
  }

  // Pending / failed without refs
  const openOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      createdAt: { gte: dayStart, lt: dayEnd },
      paymentStatus: { in: ["PENDING", "UNPAID", "FAILED"] },
      paymentReferences: { none: {} }
    },
    select: {
      id: true,
      displaySeq: true,
      totalCents: true,
      refundedCents: true,
      paymentStatus: true,
      customerName: true,
      tableLabel: true,
      createdAt: true,
      updatedAt: true
    },
    take: 200
  });

  for (const order of openOrders) {
    ledger.push({
      id: `order_open_${order.id}`,
      source: "live",
      orderId: order.id,
      orderDisplay: order.displaySeq != null ? `#${order.displaySeq}` : order.id.slice(0, 8),
      customerLabel: order.tableLabel || order.customerName || "Guest",
      amountCents: order.totalCents,
      tipCents: 0,
      feeCents: 0,
      netCents: 0,
      currency: "SEK",
      method: "pay_at_venue",
      provider: "manual",
      status: mapPaymentStatus(order.paymentStatus, order.refundedCents ?? 0, order.totalCents),
      refundedCents: order.refundedCents ?? 0,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    });
  }

  const collectedCents = ledger.filter((r) => isCollectedStatus(r.status)).reduce((s, r) => s + collectedNetCents(r), 0);

  const [yesterdaySameTimeCents, yesterdayCents] = await Promise.all([
    sumCollectedInRange(prisma, restaurantId, yesterdayStart, yesterdaySameTimeEnd),
    sumCollectedInRange(prisma, restaurantId, yesterdayStart, dayStart)
  ]);

  const analysis = buildTodayAnalysis(collectedCents, yesterdaySameTimeCents, yesterdayCents);
  return aggregateLedger(ledger, "live", timezone, dayKey, dayStart, dayEnd, analysis, enabledMethods);
}

async function sumCollectedInRange(
  prisma: PrismaClient,
  restaurantId: string,
  from: Date,
  to: Date
): Promise<number> {
  const refs = await prisma.orderPaymentReference.findMany({
    where: { restaurantId, createdAt: { gte: from, lt: to } },
    select: {
      amountCents: true,
      status: true,
      order: { select: { paymentStatus: true, refundedCents: true, totalCents: true } }
    }
  });
  let total = 0;
  const seen = new Set<string>();
  for (const ref of refs) {
    const orderRefunded = ref.order.refundedCents ?? 0;
    const status = mapPaymentStatus(
      ref.order.paymentStatus || ref.status,
      orderRefunded,
      ref.amountCents
    );
    if (!isCollectedStatus(status)) continue;
    const orderTotal = Math.max(ref.order.totalCents, 1);
    const attributedRefund = Math.min(ref.amountCents, Math.round((orderRefunded * ref.amountCents) / orderTotal));
    total += Math.max(0, ref.amountCents - attributedRefund);
  }

  const paidNoRef = await prisma.order.findMany({
    where: {
      restaurantId,
      createdAt: { gte: from, lt: to },
      paymentStatus: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] },
      paymentReferences: { none: {} }
    },
    select: { id: true, totalCents: true }
  });
  for (const o of paidNoRef) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    total += o.totalCents;
  }
  return total;
}

export type TodaysPaymentsDetailScope = "metric" | "method" | "collected" | "payment";

export type TodaysPaymentsDetailQuery = {
  scope: TodaysPaymentsDetailScope;
  key?: string;
  id?: string;
};

export type TodaysPaymentsDetailRecord = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  amountCents: number;
  currency: string;
  at: string;
  method: string;
  provider: string;
};

export type TodaysPaymentsDetail = {
  source: PaymentDataSource;
  dayKey: string;
  timezone: string;
  currency: string;
  title: string;
  subtitle: string;
  summary: {
    impact: string;
    recommendedAction: string;
  };
  relatedMetrics: Array<{ label: string; value: string }>;
  filter: TodaysPaymentsDrillFilter;
  records: TodaysPaymentsDetailRecord[];
  payment?: PaymentTransactionRow | null;
};

function applyDrillFilter(ledger: PaymentTransactionRow[], filter: TodaysPaymentsDrillFilter): PaymentTransactionRow[] {
  const idSet = filter.ids.length > 0 ? new Set(filter.ids) : null;
  const statuses = filter.statuses?.length ? new Set(filter.statuses) : null;
  const methods = filter.methods?.length ? filter.methods.map((m) => m.toLowerCase()) : null;

  return ledger.filter((row) => {
    if (idSet && !idSet.has(row.id)) return false;
    if (!idSet && statuses && !statuses.has(row.status)) return false;
    if (!idSet && methods) {
      const key = normalizeMethodKey(row.method, row.provider);
      if (!methods.includes(key)) return false;
    }
    return true;
  });
}

function detailGuidance(title: string, scope: TodaysPaymentsDetailScope, count: number): TodaysPaymentsDetail["summary"] {
  if (scope === "payment") {
    return {
      impact: "This is a single payment record from today’s ledger.",
      recommendedAction: "Review the status, method, and amount. Follow up with the guest if it failed or is still pending."
    };
  }
  if (scope === "method") {
    return {
      impact: `${count} payment${count === 1 ? "" : "s"} used this method today.`,
      recommendedAction: "Use these rows to verify volume by method and investigate any odd amounts or statuses."
    };
  }
  return {
    impact: `${title} for today — ${count} matching payment${count === 1 ? "" : "s"} from the venue ledger.`,
    recommendedAction: "Open any row that looks wrong and resolve it from the payment record."
  };
}

export async function getTodaysPaymentsDetail(
  prisma: PrismaClient,
  restaurantId: string,
  query: TodaysPaymentsDetailQuery
): Promise<TodaysPaymentsDetail | null> {
  const today = await getTodaysPayments(prisma, restaurantId);

  if (query.scope === "payment") {
    const paymentId = query.id?.trim();
    if (!paymentId) return null;
    const payment = today.ledger.find((r) => r.id === paymentId) ?? today.recent.find((r) => r.id === paymentId);
    if (!payment) return null;
    return {
      source: today.source,
      dayKey: today.dayKey,
      timezone: today.timezone,
      currency: payment.currency || today.currency,
      title: payment.orderDisplay ?? payment.orderId ?? "Payment",
      subtitle: `${payment.customerLabel} · ${methodLabel(normalizeMethodKey(payment.method, payment.provider))}`,
      summary: detailGuidance("Payment", "payment", 1),
      relatedMetrics: [
        { label: "Status", value: payment.status.replace(/_/g, " ") },
        { label: "Amount", value: formatMoneyLabel(payment.amountCents, payment.currency) },
        { label: "Refunded", value: formatMoneyLabel(payment.refundedCents, payment.currency) },
        { label: "Net", value: formatMoneyLabel(payment.netCents, payment.currency) },
        { label: "Provider", value: payment.provider },
        { label: "Method", value: methodLabel(normalizeMethodKey(payment.method, payment.provider)) }
      ],
      filter: {
        target: "transactions",
        ids: [payment.id],
        day: today.dayKey
      },
      records: [
        {
          id: payment.id,
          title: payment.orderDisplay ?? payment.orderId ?? payment.id,
          subtitle: `${payment.customerLabel} · ${methodLabel(normalizeMethodKey(payment.method, payment.provider))}`,
          statusLabel: payment.status.replace(/_/g, " "),
          amountCents: payment.amountCents,
          currency: payment.currency,
          at: payment.createdAt,
          method: payment.method,
          provider: payment.provider
        }
      ],
      payment
    };
  }

  let filter: TodaysPaymentsDrillFilter | null = null;
  let title = "Today’s payments";
  let subtitle = `Venue day ${today.dayKey}`;

  if (query.scope === "collected") {
    const metric = today.metrics.find((m) => m.key === "collected");
    if (!metric) return null;
    filter = metric.filter;
    title = metric.label;
    subtitle = metric.valueLabel;
  } else if (query.scope === "metric") {
    const key = query.key?.trim();
    if (!key) return null;
    const metric = today.metrics.find((m) => m.key === key);
    if (!metric) return null;
    filter = metric.filter;
    title = metric.label;
    subtitle = metric.valueLabel;
  } else if (query.scope === "method") {
    const key = query.key?.trim();
    if (!key) return null;
    const method = today.methods.find((m) => m.key === key);
    if (!method) return null;
    filter = method.filter;
    title = method.label;
    subtitle = `${method.count} payment${method.count === 1 ? "" : "s"} · ${formatMoneyLabel(method.amountCents, method.currency)}`;
  }

  if (!filter) return null;

  const rows = applyDrillFilter(today.ledger, filter);
  const totalCents = rows.reduce((sum, r) => sum + r.amountCents, 0);
  const refundedCents = rows.reduce((sum, r) => sum + Math.max(0, r.refundedCents), 0);

  return {
    source: today.source,
    dayKey: today.dayKey,
    timezone: today.timezone,
    currency: today.currency,
    title,
    subtitle,
    summary: detailGuidance(title, query.scope, rows.length),
    relatedMetrics: [
      { label: "Matching payments", value: String(rows.length) },
      { label: "Gross amount", value: formatMoneyLabel(totalCents, today.currency) },
      { label: "Refunded", value: formatMoneyLabel(refundedCents, today.currency) },
      { label: "Collected today", value: formatMoneyLabel(today.aggregates.collectedCents, today.currency) },
      { label: "Timezone", value: today.timezone.replace(/_/g, " ") },
      { label: "Day", value: today.dayKey }
    ],
    filter,
    records: rows.slice(0, 60).map((r) => ({
      id: r.id,
      title: r.orderDisplay ?? r.orderId ?? r.id,
      subtitle: `${r.customerLabel} · ${methodLabel(normalizeMethodKey(r.method, r.provider))} · ${r.provider}`,
      statusLabel: r.status.replace(/_/g, " "),
      amountCents: r.amountCents,
      currency: r.currency,
      at: r.createdAt,
      method: r.method,
      provider: r.provider
    })),
    payment: null
  };
}
