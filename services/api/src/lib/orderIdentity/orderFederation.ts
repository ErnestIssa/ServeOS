import { createHash } from "node:crypto";

export const FEDERATION_NAMESPACE = "serveos-global" as const;

/** Global federation ID for cross-network order references. */
export function deriveFederationId(input: {
  restaurantId: string;
  internalOrderId: string;
  createdAt: Date;
}): string {
  const digest = createHash("sha256")
    .update(`${FEDERATION_NAMESPACE}:${input.restaurantId}:${input.internalOrderId}:${input.createdAt.toISOString()}`)
    .digest("hex");
  return `${FEDERATION_NAMESPACE}:${digest.slice(0, 32)}`;
}

export const ORDER_FEDERATION_POLICY = {
  namespace: FEDERATION_NAMESPACE,
  purpose: "cross-venue analytics, future multi-brand federation, external registry sync",
  immutableAfterAssignment: true,
  notAReplacementForInternalId: true
} as const;
