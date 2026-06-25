import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CanonicalOrderSource,
  SourceInterpretationType,
  CompositionalSourceAttribution,
  SourceAttributionModifier
} from "./orderSourceTypes.js";
import { appendOrderAuditLog } from "../orders/orderAuditService.js";
import { normalizeToCanonicalSource } from "./orderSourceResolution.js";

/** Allowed reinterpretations — original Order.source never mutates. */
const SOURCE_INTERPRETATION_RULES: Record<
  CanonicalOrderSource,
  Partial<Record<SourceInterpretationType, { allowed: boolean; requiresStaff: boolean }>>
> = {
  QR_ORDER: {
    STAFF_ASSISTED: { allowed: true, requiresStaff: true },
    HYBRID_STAFF_LINE_ADDITION: { allowed: true, requiresStaff: true },
    SOURCE_CORRECTION_LOGGED: { allowed: true, requiresStaff: true }
  },
  WALK_IN: {
    CONVERTED_TO_RESERVATION: { allowed: true, requiresStaff: true },
    STAFF_ASSISTED: { allowed: true, requiresStaff: false }
  },
  STAFF_CREATED: {
    SOURCE_CORRECTION_LOGGED: { allowed: true, requiresStaff: true }
  },
  PHONE_ORDER: {
    CONVERTED_TO_RESERVATION: { allowed: true, requiresStaff: true }
  },
  RESERVATION_ORDER: {
    STAFF_ASSISTED: { allowed: true, requiresStaff: true }
  },
  DELIVERY_PARTNER: {
    PARTNER_REASSIGNED_INTERNAL: { allowed: true, requiresStaff: true },
    SOURCE_CORRECTION_LOGGED: { allowed: true, requiresStaff: true }
  }
};

export function canApplySourceInterpretation(
  primarySource: CanonicalOrderSource,
  interpretation: SourceInterpretationType,
  actorIsStaff: boolean
): void {
  const rule = SOURCE_INTERPRETATION_RULES[primarySource]?.[interpretation];
  if (!rule?.allowed) {
    throw Object.assign(new Error("source_interpretation_not_allowed"), { statusCode: 409 });
  }
  if (rule.requiresStaff && !actorIsStaff) {
    throw Object.assign(new Error("source_interpretation_staff_required"), { statusCode: 403 });
  }
}

export function appendAttributionModifier(
  attribution: CompositionalSourceAttribution,
  modifier: Omit<SourceAttributionModifier, "at">
): CompositionalSourceAttribution {
  return {
    ...attribution,
    modifiers: [
      ...attribution.modifiers,
      { ...modifier, at: new Date().toISOString() }
    ]
  };
}

export async function recordSourceInterpretation(
  tx: Parameters<typeof appendOrderAuditLog>[0],
  input: {
    orderId: string;
    restaurantId: string;
    primarySource: CanonicalOrderSource;
    interpretation: SourceInterpretationType;
    actorUserId?: string | null;
    actorIsStaff: boolean;
    note?: string;
    currentMetadata?: Prisma.JsonValue | null;
  }
): Promise<{ modifier: SourceAttributionModifier; updatedModifiers: SourceAttributionModifier[] }> {
  canApplySourceInterpretation(input.primarySource, input.interpretation, input.actorIsStaff);

  const modifier: SourceAttributionModifier = {
    type: input.interpretation,
    at: new Date().toISOString(),
    actorUserId: input.actorUserId ?? null,
    note: input.note
  };

  const existing =
    (input.currentMetadata as { compositionalAttribution?: CompositionalSourceAttribution } | null)
      ?.compositionalAttribution?.modifiers ?? [];

  await appendOrderAuditLog(tx, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: "source.interpretation_recorded",
    actorUserId: input.actorUserId ?? null,
    actorSource: input.actorIsStaff ? "STAFF" : "CUSTOMER",
    afterState: {
      primarySource: input.primarySource,
      interpretation: input.interpretation
    },
    metadata: { modifier, immutableOriginalSource: true }
  });

  return { modifier, updatedModifiers: [...existing, modifier] };
}

export async function persistSourceInterpretation(
  prisma: PrismaClient,
  input: {
    orderId: string;
    restaurantId: string;
    interpretation: SourceInterpretationType;
    actorUserId?: string | null;
    actorIsStaff: boolean;
    note?: string;
  }
) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    select: { id: true, source: true, sourceMetadata: true }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const primarySource = normalizeToCanonicalSource(order.source);

  return prisma.$transaction(async (tx) => {
    const { modifier, updatedModifiers } = await recordSourceInterpretation(tx, {
      ...input,
      primarySource,
      currentMetadata: order.sourceMetadata
    });

    const meta = (order.sourceMetadata ?? {}) as Record<string, unknown>;
    const compositional = (meta.compositionalAttribution as CompositionalSourceAttribution | undefined) ?? {
      primarySource,
      modifiers: [],
      revenueSplitPolicy: "primary_100" as const
    };

    const updatedMetadata = {
      ...meta,
      compositionalAttribution: { ...compositional, modifiers: updatedModifiers }
    };

    await tx.order.update({
      where: { id: order.id },
      data: { sourceMetadata: updatedMetadata as Prisma.InputJsonValue }
    });

    return { modifier, compositionalAttribution: updatedMetadata.compositionalAttribution };
  });
}

export const SOURCE_LIFECYCLE_RULES = {
  immutability: "Order.source field never changes after placement",
  reinterpretation: "lifecycle overlays via source.interpretation_recorded audit + compositional modifiers"
} as const;
