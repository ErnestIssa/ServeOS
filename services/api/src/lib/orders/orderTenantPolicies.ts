import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { ORDER_SLA_POLICY } from "./orderSlaPolicies.js";

/** Default engine rules — overridden per restaurant via `Restaurant.orderEnginePolicy`. */
export const DEFAULT_ORDER_ENGINE_POLICY = {
  cancelAfterAccepted: false,
  cancelAfterKitchenStart: false,
  autoAcceptOnPayment: false,
  autoAcceptOnCreate: false,
  refundRequiresManager: true,
  customerCancelBeforeAccepted: true,
  sla: {
    maxActiveAgeMs: ORDER_SLA_POLICY.maxActiveAgeMs,
    preparingDelayWarningMs: ORDER_SLA_POLICY.preparingDelayWarningMs,
    acceptedWithoutPrepEscalationMs: ORDER_SLA_POLICY.acceptedWithoutPrepEscalationMs,
    readyHandoffDelayMs: ORDER_SLA_POLICY.readyHandoffDelayMs
  },
  recovery: {
    autoEscalateStuckOrders: true,
    autoRetryKdsOutbox: true,
    autoReconcilePaidMismatch: true
  }
} as const;

const tenantPolicySchema = z
  .object({
    cancelAfterAccepted: z.boolean().optional(),
    cancelAfterKitchenStart: z.boolean().optional(),
    autoAcceptOnPayment: z.boolean().optional(),
    autoAcceptOnCreate: z.boolean().optional(),
    refundRequiresManager: z.boolean().optional(),
    customerCancelBeforeAccepted: z.boolean().optional(),
    sla: z
      .object({
        maxActiveAgeMs: z.number().int().positive().optional(),
        preparingDelayWarningMs: z.number().int().positive().optional(),
        acceptedWithoutPrepEscalationMs: z.number().int().positive().optional(),
        readyHandoffDelayMs: z.number().int().positive().optional()
      })
      .optional(),
    recovery: z
      .object({
        autoEscalateStuckOrders: z.boolean().optional(),
        autoRetryKdsOutbox: z.boolean().optional(),
        autoReconcilePaidMismatch: z.boolean().optional()
      })
      .optional()
  })
  .partial();

export type OrderEngineTenantPolicy = {
  cancelAfterAccepted: boolean;
  cancelAfterKitchenStart: boolean;
  autoAcceptOnPayment: boolean;
  autoAcceptOnCreate: boolean;
  refundRequiresManager: boolean;
  customerCancelBeforeAccepted: boolean;
  sla: {
    maxActiveAgeMs: number;
    preparingDelayWarningMs: number;
    acceptedWithoutPrepEscalationMs: number;
    readyHandoffDelayMs: number;
  };
  recovery: {
    autoEscalateStuckOrders: boolean;
    autoRetryKdsOutbox: boolean;
    autoReconcilePaidMismatch: boolean;
  };
};

export function mergeOrderEnginePolicy(raw: unknown): OrderEngineTenantPolicy {
  const parsed = tenantPolicySchema.safeParse(raw ?? {});
  const p = parsed.success ? parsed.data : {};
  return {
    cancelAfterAccepted: p.cancelAfterAccepted ?? DEFAULT_ORDER_ENGINE_POLICY.cancelAfterAccepted,
    cancelAfterKitchenStart: p.cancelAfterKitchenStart ?? DEFAULT_ORDER_ENGINE_POLICY.cancelAfterKitchenStart,
    autoAcceptOnPayment: p.autoAcceptOnPayment ?? DEFAULT_ORDER_ENGINE_POLICY.autoAcceptOnPayment,
    autoAcceptOnCreate: p.autoAcceptOnCreate ?? DEFAULT_ORDER_ENGINE_POLICY.autoAcceptOnCreate,
    refundRequiresManager: p.refundRequiresManager ?? DEFAULT_ORDER_ENGINE_POLICY.refundRequiresManager,
    customerCancelBeforeAccepted:
      p.customerCancelBeforeAccepted ?? DEFAULT_ORDER_ENGINE_POLICY.customerCancelBeforeAccepted,
    sla: { ...DEFAULT_ORDER_ENGINE_POLICY.sla, ...(p.sla ?? {}) },
    recovery: { ...DEFAULT_ORDER_ENGINE_POLICY.recovery, ...(p.recovery ?? {}) }
  };
}

export async function loadRestaurantOrderPolicy(
  prisma: PrismaClient,
  restaurantId: string
): Promise<OrderEngineTenantPolicy> {
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { orderEnginePolicy: true }
  });
  return mergeOrderEnginePolicy(row?.orderEnginePolicy);
}
