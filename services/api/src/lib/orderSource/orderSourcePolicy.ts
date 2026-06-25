import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { CanonicalOrderSource, OrderSourceContract } from "./orderSourceTypes.js";
import { getSourceContract, ORDER_SOURCE_CONTRACTS } from "./orderSourceContracts.js";

const paymentOverrideSchema = z
  .object({
    paymentRequiredBeforeAcceptance: z.boolean().optional(),
    paymentRequiredBeforePreparation: z.boolean().optional(),
    payLaterAllowed: z.boolean().optional(),
    defaultInitialStatus: z.enum(["CREATED", "PENDING_PAYMENT", "PAID"]).optional()
  })
  .partial();

const sourceOverrideSchema = z
  .object({
    payment: paymentOverrideSchema.optional(),
    notifications: z
      .object({
        smsAllowed: z.boolean().optional(),
        notifyCustomerOnStatus: z.boolean().optional()
      })
      .optional()
  })
  .partial();

const tenantSourcePolicySchema = z
  .object({
    sources: z.record(z.string(), sourceOverrideSchema).optional()
  })
  .partial();

export type TenantSourcePolicy = {
  sources: Partial<Record<CanonicalOrderSource, z.infer<typeof sourceOverrideSchema>>>;
};

export function mergeTenantSourcePolicy(raw: unknown): TenantSourcePolicy {
  const parsed = tenantSourcePolicySchema.safeParse(raw ?? {});
  return { sources: parsed.success ? (parsed.data.sources ?? {}) : {} };
}

export async function loadRestaurantSourcePolicy(
  prisma: PrismaClient,
  restaurantId: string
): Promise<TenantSourcePolicy> {
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { orderSourcePolicy: true }
  });
  return mergeTenantSourcePolicy(row?.orderSourcePolicy);
}

/** Merge tenant overrides onto canonical contract — never removes validation gates. */
export function resolveEffectiveSourceContract(
  source: CanonicalOrderSource,
  tenant?: TenantSourcePolicy
): OrderSourceContract {
  const base = getSourceContract(source);
  const override = tenant?.sources?.[source];
  if (!override) return base;

  return {
    ...base,
    payment: { ...base.payment, ...(override.payment ?? {}) },
    notifications: { ...base.notifications, ...(override.notifications ?? {}) }
  };
}

export function listAllSourceContracts(tenant?: TenantSourcePolicy): OrderSourceContract[] {
  return (Object.keys(ORDER_SOURCE_CONTRACTS) as CanonicalOrderSource[]).map((s) =>
    resolveEffectiveSourceContract(s, tenant)
  );
}
