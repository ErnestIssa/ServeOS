/**
 * Human-readable tenant display number formatting — backend-only.
 */

export function formatTenantDisplayNumber(
  displaySeq: number | null | undefined,
  displayPeriodKey: string
): string {
  if (displaySeq == null || displaySeq <= 0) return "#0";
  if (displayPeriodKey === "all" || displayPeriodKey === "legacy") {
    return `#${displaySeq}`;
  }
  return `#${displayPeriodKey}-${displaySeq}`;
}

/** @deprecated Use formatTenantDisplayNumber — kept for order engine backward compatibility. */
export function formatDisplayNumber(
  displaySeq: number | null | undefined,
  orderId: string,
  displayPeriodKey = "all"
): string {
  if (displaySeq != null && displaySeq > 0) {
    return formatTenantDisplayNumber(displaySeq, displayPeriodKey);
  }
  return `#${orderId.slice(-6).toUpperCase()}`;
}
