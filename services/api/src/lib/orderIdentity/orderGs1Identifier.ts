import { createHash } from "node:crypto";

/**
 * GS1-inspired application identifier for cross-system trade item reference.
 * Format: SRVOS.{venueCode}.{period}.{seq}.{check}
 * Not a registered GTIN — structured for partner/POS interoperability.
 */
export function deriveGs1StyleIdentifier(input: {
  restaurantId: string;
  displayPeriodKey: string;
  displaySeq: number;
  internalOrderId: string;
}): string {
  const venueCode = createHash("sha256").update(input.restaurantId).digest("hex").slice(0, 8).toUpperCase();
  const period = input.displayPeriodKey === "all" || input.displayPeriodKey === "legacy"
    ? "0000"
    : input.displayPeriodKey.replace(/-/g, "");
  const seq = String(input.displaySeq).padStart(6, "0");
  const check = createHash("sha256")
    .update(`${input.restaurantId}:${input.displayPeriodKey}:${input.displaySeq}:${input.internalOrderId}`)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
  return `SRVOS.${venueCode}.${period}.${seq}.${check}`;
}

export const GS1_IDENTITY_POLICY = {
  format: "SRVOS.{venueCode}.{period}.{seq}.{check}",
  registeredGtin: false,
  immutableAfterAssignment: true,
  useCase: "partner POS, supply-chain style referencing, receipt barcodes"
} as const;
