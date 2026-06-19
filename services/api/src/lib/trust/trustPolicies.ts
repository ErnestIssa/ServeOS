import type { TrustActionType } from "@prisma/client";

/** Risk tier thresholds (0–100). */
export const RISK_TIER = {
  LOW_MAX: 19,
  MEDIUM_MAX: 49,
  HIGH_MAX: 79
} as const;

/** Discount % above which manager approval is required. */
export const DISCOUNT_APPROVAL_THRESHOLD_PCT = 15;

/** Discount % above which owner approval is required. */
export const DISCOUNT_OWNER_THRESHOLD_PCT = 50;

/** Full comp (100% discount) always requires owner-level approval. */
export const COMP_APPROVAL_THRESHOLD_PCT = 100;

/** Order total cents above which self-order status changes need manager approval. */
export const SELF_ORDER_HIGH_VALUE_CENTS = 5000;

/** Max discount actions per staff per 24h before escalation. */
export const MAX_DISCOUNTS_PER_24H = 3;

/** Velocity window: actions in 30 seconds. */
export const VELOCITY_WINDOW_MS = 30_000;
export const VELOCITY_ACTION_THRESHOLD = 10;

/** Approval task expiry (minutes). */
export const APPROVAL_EXPIRY_MINUTES = 30;

/** Financial actions always audited. */
export const HIGH_RISK_ACTIONS: TrustActionType[] = [
  "DISCOUNT",
  "REFUND",
  "COMP",
  "ORDER_CANCEL",
  "PRICE_EDIT"
];

export function discountPercent(discountCents: number, subtotalCents: number): number {
  if (subtotalCents <= 0) return discountCents > 0 ? 100 : 0;
  return Math.round((discountCents / subtotalCents) * 100);
}

export function decisionFromRiskScore(score: number): "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK" | "FLAG" {
  if (score >= 80) return "BLOCK";
  if (score >= 50) return "REQUIRE_APPROVAL";
  if (score >= 20) return "FLAG";
  return "ALLOW";
}
