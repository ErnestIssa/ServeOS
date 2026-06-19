import type { Prisma, PrismaClient } from "@prisma/client";
import type { TrustEvaluationInput } from "./trustTypes.js";

export async function createTrustEvent(
  prisma: PrismaClient,
  input: TrustEvaluationInput & {
    type: "FRAUD_DETECTED" | "APPROVAL_REQUESTED" | "BLOCKED" | "AUDIT_LOG";
    riskScore: number;
    decision: "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK" | "FLAG";
    status?: "PENDING" | "RESOLVED" | "FINAL";
  }
) {
  return prisma.trustEvent.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      actionType: input.actionType,
      context: input.actorContext,
      riskScore: input.riskScore,
      decision: input.decision,
      status: input.status ?? (input.decision === "ALLOW" ? "FINAL" : "PENDING"),
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
    }
  });
}

export async function persistFraudEvaluation(
  prisma: PrismaClient,
  trustEventId: string,
  workspaceId: string,
  userId: string,
  signals: Array<{ detectorType: string; severity: number; reason: Record<string, unknown> }>,
  finalScore: number,
  decision: "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK" | "FLAG"
) {
  if (signals.length > 0) {
    await prisma.fraudSignal.createMany({
      data: signals.map((s) => ({
        trustEventId,
        workspaceId,
        userId,
        detectorType: s.detectorType as never,
        severity: s.severity,
        reason: s.reason as Prisma.InputJsonValue
      }))
    });
  }
  await prisma.fraudScore.create({
    data: {
      trustEventId,
      finalScore,
      decision
    }
  });
}

export async function markTrustEventExecuted(
  prisma: PrismaClient,
  trustEventId: string
) {
  await prisma.trustEvent.update({
    where: { id: trustEventId },
    data: { type: "EXECUTED", status: "FINAL", decision: "ALLOW" }
  });
}

export async function markTrustEventBlocked(
  prisma: PrismaClient,
  trustEventId: string
) {
  await prisma.trustEvent.update({
    where: { id: trustEventId },
    data: { type: "BLOCKED", status: "FINAL" }
  });
}
