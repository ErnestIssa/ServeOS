import type { PrismaClient } from "@prisma/client";
import { isVenueMembershipRole } from "../membershipAccess.js";
import {
  COMP_APPROVAL_THRESHOLD_PCT,
  DISCOUNT_APPROVAL_THRESHOLD_PCT,
  DISCOUNT_OWNER_THRESHOLD_PCT,
  MAX_DISCOUNTS_PER_24H,
  SELF_ORDER_HIGH_VALUE_CENTS,
  VELOCITY_ACTION_THRESHOLD,
  VELOCITY_WINDOW_MS,
  decisionFromRiskScore,
  discountPercent
} from "./trustPolicies.js";
import type { FraudSignalResult, TrustEvaluationInput, TrustEvaluationResult } from "./trustTypes.js";

const FINANCIAL_ACTIONS = new Set(["DISCOUNT", "REFUND", "COMP", "PRICE_EDIT", "ORDER_CANCEL"]);

const SENSITIVE_STATUS = new Set(["CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]);

export async function evaluateTrustAction(
  prisma: PrismaClient,
  input: TrustEvaluationInput
): Promise<TrustEvaluationResult> {
  const signals: FraudSignalResult[] = [];
  const reasons: string[] = [];

  const customerUserId = input.metadata?.customerUserId ?? null;
  const isSelfOrder =
    !!customerUserId &&
    customerUserId === input.actorUserId &&
    input.actorContext === "STAFF";

  if (isSelfOrder && FINANCIAL_ACTIONS.has(input.actionType)) {
    signals.push({
      detectorType: "COI_DETECTED",
      severity: 85,
      reason: { rule: "self_order_financial_block", customerUserId, actorUserId: input.actorUserId }
    });
    reasons.push("Staff cannot apply financial changes to their own customer order.");
  }

  if (isSelfOrder && input.actionType === "ORDER_STATUS") {
    const target = input.metadata?.targetStatus ?? "";
    if (SENSITIVE_STATUS.has(target)) {
      const orderTotal = input.metadata?.orderTotalCents ?? 0;
      const severity =
        orderTotal >= SELF_ORDER_HIGH_VALUE_CENTS ? 75 : target === "CANCELLED" ? 80 : 65;
      signals.push({
        detectorType: "COI_DETECTED",
        severity,
        reason: { rule: "self_order_status_gate", targetStatus: target, orderTotalCents: orderTotal }
      });
      reasons.push(`Self-order status change to ${target} requires independent approval.`);
    }
  }

  if (input.actionType === "DISCOUNT" || input.actionType === "COMP") {
    const subtotal = input.metadata?.orderSubtotalCents ?? 0;
    const discount = input.metadata?.discountCents ?? 0;
    const pct = discountPercent(discount, subtotal);

    if (pct >= COMP_APPROVAL_THRESHOLD_PCT) {
      signals.push({
        detectorType: "DISCOUNT_ABUSE",
        severity: 90,
        reason: { rule: "full_comp", discountPercent: pct }
      });
      reasons.push("Full comp requires owner approval.");
    } else if (pct >= DISCOUNT_OWNER_THRESHOLD_PCT) {
      signals.push({
        detectorType: "DISCOUNT_ABUSE",
        severity: 70,
        reason: { rule: "high_discount", discountPercent: pct }
      });
      reasons.push(`Discount of ${pct}% requires owner approval.`);
    } else if (pct >= DISCOUNT_APPROVAL_THRESHOLD_PCT) {
      signals.push({
        detectorType: "DISCOUNT_ABUSE",
        severity: 55,
        reason: { rule: "medium_discount", discountPercent: pct }
      });
      reasons.push(`Discount of ${pct}% requires manager approval.`);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDiscounts = await prisma.trustEvent.count({
      where: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actionType: { in: ["DISCOUNT", "COMP"] },
        createdAt: { gte: since },
        decision: { in: ["ALLOW", "REQUIRE_APPROVAL", "FLAG"] }
      }
    });
    if (recentDiscounts >= MAX_DISCOUNTS_PER_24H) {
      signals.push({
        detectorType: "DISCOUNT_ABUSE",
        severity: 60,
        reason: { rule: "discount_frequency", count: recentDiscounts }
      });
      reasons.push("Unusual discount frequency detected.");
    }
  }

  if (input.actionType === "REFUND") {
    signals.push({
      detectorType: "REFUND_ABUSE",
      severity: 60,
      reason: { rule: "refund_always_gated" }
    });
    reasons.push("Refunds require manager approval.");

    if (isSelfOrder) {
      signals.push({
        detectorType: "REFUND_ABUSE",
        severity: 95,
        reason: { rule: "self_refund" }
      });
      reasons.push("Self-refund is blocked.");
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRefunds = await prisma.trustEvent.count({
      where: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actionType: "REFUND",
        createdAt: { gte: since }
      }
    });
    if (recentRefunds >= 3) {
      signals.push({
        detectorType: "REFUND_ABUSE",
        severity: 75,
        reason: { rule: "refund_loop", count: recentRefunds }
      });
      reasons.push("Repeated refund pattern detected.");
    }
  }

  if (input.actionType === "ORDER_CANCEL") {
    signals.push({
      detectorType: "ROLE_ABUSE",
      severity: 55,
      reason: { rule: "cancel_gated" }
    });
    reasons.push("Order cancellation requires approval after preparation.");
  }

  const velocity = await bumpVelocity(prisma, input);
  if (velocity >= VELOCITY_ACTION_THRESHOLD) {
    signals.push({
      detectorType: "VELOCITY_ANOMALY",
      severity: 70,
      reason: { rule: "velocity_burst", count: velocity }
    });
    reasons.push("Too many actions in a short window.");
  }

  if (isSelfOrder && input.actorContext === "STAFF") {
    const recentContextSwitch = await prisma.trustEvent.findFirst({
      where: {
        userId: input.actorUserId,
        actionType: "ORDER_STATUS",
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
      },
      orderBy: { createdAt: "desc" }
    });
    if (recentContextSwitch) {
      signals.push({
        detectorType: "IDENTITY_SWITCHING",
        severity: 65,
        reason: { rule: "post_context_switch_action" }
      });
      reasons.push("Action shortly after identity context switch.");
    }
  }

  const actorRole = input.metadata?.actorMembershipRole ?? "";
  if (actorRole === "MANAGER" && signals.some((s) => s.severity >= 70)) {
    signals.push({
      detectorType: "ROLE_ABUSE",
      severity: 40,
      reason: { rule: "manager_high_risk_action" }
    });
    reasons.push("High-risk manager action flagged for owner review.");
  }

  const riskScore = aggregateRiskScore(signals);
  let decision = decisionFromRiskScore(riskScore);

  if (isSelfOrder && FINANCIAL_ACTIONS.has(input.actionType)) {
    decision = "BLOCK";
  }
  if (isSelfOrder && input.actionType === "REFUND") {
    decision = "BLOCK";
  }

  const requiredRole = resolveRequiredRole(signals, decision, input);

  return { riskScore, decision, signals, requiredRole, reasons };
}

function aggregateRiskScore(signals: FraudSignalResult[]): number {
  if (signals.length === 0) return 0;
  const max = Math.max(...signals.map((s) => s.severity));
  const avg = signals.reduce((sum, s) => sum + s.severity, 0) / signals.length;
  return Math.min(100, Math.round(max * 0.7 + avg * 0.3));
}

function resolveRequiredRole(
  signals: FraudSignalResult[],
  decision: string,
  input: TrustEvaluationInput
): "MANAGER" | "OWNER" | "SHIFT_LEAD" | "INDEPENDENT_STAFF" | undefined {
  if (decision !== "REQUIRE_APPROVAL") return undefined;

  const hasCoi = signals.some((s) => s.detectorType === "COI_DETECTED");
  const hasFullComp = signals.some(
    (s) => s.detectorType === "DISCOUNT_ABUSE" && (s.reason.discountPercent as number) >= COMP_APPROVAL_THRESHOLD_PCT
  );
  const hasOwnerDiscount = signals.some(
    (s) =>
      s.detectorType === "DISCOUNT_ABUSE" &&
      typeof s.reason.discountPercent === "number" &&
      (s.reason.discountPercent as number) >= DISCOUNT_OWNER_THRESHOLD_PCT
  );

  if (hasFullComp || hasOwnerDiscount) return "OWNER";
  if (hasCoi) return "INDEPENDENT_STAFF";
  if (input.actionType === "REFUND" || input.actionType === "ORDER_CANCEL") return "MANAGER";
  return "MANAGER";
}

async function bumpVelocity(prisma: PrismaClient, input: TrustEvaluationInput): Promise<number> {
  const key = {
    workspaceId_userId_actionType: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actionType: input.actionType
    }
  };
  const now = new Date();
  const existing = await prisma.trustActionVelocity.findUnique({ where: key });
  if (!existing) {
    await prisma.trustActionVelocity.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        actionType: input.actionType,
        count: 1,
        windowStart: now
      }
    });
    return 1;
  }
  const elapsed = now.getTime() - existing.windowStart.getTime();
  if (elapsed > VELOCITY_WINDOW_MS) {
    await prisma.trustActionVelocity.update({
      where: key,
      data: { count: 1, windowStart: now }
    });
    return 1;
  }
  const next = existing.count + 1;
  await prisma.trustActionVelocity.update({
    where: key,
    data: { count: next }
  });
  return next;
}

export async function actorIsVenueStaff(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string
): Promise<{ isStaff: boolean; role: string | null }> {
  const m = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { role: true, status: true }
  });
  if (!m || m.status !== "ACTIVE" || !isVenueMembershipRole(m.role)) {
    return { isStaff: false, role: null };
  }
  return { isStaff: true, role: m.role };
}
