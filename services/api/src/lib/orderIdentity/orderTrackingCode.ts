import type { OrderIdentityPolicy } from "./orderIdentityTypes.js";

/** Derived tracking identity — safe to regenerate; never used as primary key. */
export function deriveTrackingCode(input: {
  displaySeq: number | null | undefined;
  displayPeriodKey: string;
  internalOrderId: string;
  policy: Pick<OrderIdentityPolicy, "trackingCodePrefix">;
}): string {
  const prefix = input.policy.trackingCodePrefix || "ORD";
  const num = String(input.displaySeq ?? 0);
  const suffix = input.internalOrderId.slice(-4).toUpperCase();
  if (input.displayPeriodKey !== "all" && input.displayPeriodKey !== "legacy") {
    return `${prefix}-${input.displayPeriodKey}-${num}-${suffix}`;
  }
  return `${prefix}-${num}-${suffix}`;
}
