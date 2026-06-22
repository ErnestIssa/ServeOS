import { createHash } from "node:crypto";
import type { InternalIdSchema } from "./orderUlid.js";
import { generateUlid, isUlid } from "./orderUlid.js";

const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

export function assertValidInternalOrderId(id: string): void {
  if (!id || typeof id !== "string" || id.length < 20) {
    throw Object.assign(new Error("invalid_internal_order_id"), { statusCode: 400 });
  }
  if (!CUID_PATTERN.test(id) && !isUlid(id) && !/^[0-9a-f-]{36}$/i.test(id)) {
    throw Object.assign(new Error("invalid_internal_order_id_format"), { statusCode: 400 });
  }
}

export function generateInternalOrderId(schema: InternalIdSchema = "cuid"): {
  id: string;
  schema: InternalIdSchema;
} {
  if (schema === "ulid") {
    return { id: generateUlid(), schema: "ulid" };
  }
  return { id: "", schema: "cuid" };
}

export const INTERNAL_ORDER_ID_RULES = {
  generator: "prisma_cuid_or_ulid_policy",
  mutable: false,
  exposedToEndUsers: false,
  canonicalCrossServiceReference: true,
  supportedSchemas: ["cuid", "ulid"] as const
} as const;
