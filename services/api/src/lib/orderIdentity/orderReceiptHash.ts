import { createHash } from "node:crypto";

export function computeReceiptSearchHash(input: {
  orderId: string;
  restaurantId: string;
  displaySeq: number | null;
  displayPeriodKey: string;
  totalCents: number;
  createdAt: Date;
}): string {
  const payload = [
    input.orderId,
    input.restaurantId,
    String(input.displaySeq ?? 0),
    input.displayPeriodKey,
    String(input.totalCents),
    input.createdAt.toISOString()
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/** Short code for receipt printing — first 12 chars of hash. */
export function receiptLookupCode(fullHash: string): string {
  return fullHash.slice(0, 12).toUpperCase();
}

export const RECEIPT_HASH_POLICY = {
  algorithm: "sha256",
  searchable: true,
  immutableAfterAssignment: true,
  lookupCodeLength: 12
} as const;
