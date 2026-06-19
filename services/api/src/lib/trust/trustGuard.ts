import type { EventEmitter } from "node:events";
import type { PrismaClient } from "@prisma/client";
import { publishDomainEvent } from "../../notifications/eventBus.js";
import { createApprovalTask } from "./approvalEngine.js";
import { writeTrustAuditLog } from "./auditLogService.js";
import { actorIsVenueStaff, evaluateTrustAction } from "./fraudEngine.js";
import {
  createTrustEvent,
  markTrustEventBlocked,
  persistFraudEvaluation
} from "./trustEventService.js";
import type { TrustEvaluationInput, TrustGuardOutcome } from "./trustTypes.js";

export type GuardActionInput = TrustEvaluationInput & {
  executePayload?: Record<string, unknown>;
  skipIfApprovalId?: string;
};

export async function guardSensitiveAction(
  prisma: PrismaClient,
  input: GuardActionInput,
  domainEventBus?: EventEmitter
): Promise<TrustGuardOutcome> {
  if (input.skipIfApprovalId) {
    const approved = await prisma.approvalTask.findUnique({
      where: { id: input.skipIfApprovalId },
      include: { trustEvent: true }
    });
    if (!approved || approved.status !== "APPROVED") {
      throw Object.assign(new Error("approval_not_approved"), { statusCode: 403 });
    }
    if (approved.requestedByUserId !== input.actorUserId) {
      throw Object.assign(new Error("approval_requester_mismatch"), { statusCode: 403 });
    }
    return {
      ok: true,
      trustEventId: approved.trustEventId,
      decision: "ALLOW"
    };
  }

  const evaluation = await evaluateTrustAction(prisma, input);

  const trustEvent = await createTrustEvent(prisma, {
    ...input,
    type: evaluation.decision === "BLOCK" ? "BLOCKED" : "FRAUD_DETECTED",
    riskScore: evaluation.riskScore,
    decision: evaluation.decision,
    payload: input.executePayload ?? input.payload
  });

  await persistFraudEvaluation(
    prisma,
    trustEvent.id,
    input.workspaceId,
    input.actorUserId,
    evaluation.signals,
    evaluation.riskScore,
    evaluation.decision
  );

  await emitTrustDomainEvent(domainEventBus, {
    trustEventId: trustEvent.id,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    riskScore: evaluation.riskScore,
    decision: evaluation.decision,
    reasons: evaluation.reasons
  });

  if (evaluation.decision === "BLOCK") {
    await markTrustEventBlocked(prisma, trustEvent.id);
    await writeTrustAuditLog(prisma, {
      trustEventId: trustEvent.id,
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.executePayload,
      afterState: { blocked: true, reasons: evaluation.reasons },
      ipAddress: input.metadata?.ipAddress,
      deviceId: input.metadata?.deviceId
    });
    return {
      ok: false,
      trustEventId: trustEvent.id,
      decision: "BLOCK",
      error: "trust_action_blocked",
      riskScore: evaluation.riskScore,
      reasons: evaluation.reasons
    };
  }

  if (evaluation.decision === "REQUIRE_APPROVAL") {
    const requiredRole = evaluation.requiredRole ?? "MANAGER";
    const task = await createApprovalTask(prisma, {
      trustEventId: trustEvent.id,
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      requestedByUserId: input.actorUserId,
      requiredRole,
      riskScore: evaluation.riskScore,
      payload: input.executePayload
    });

    await emitTrustDomainEvent(domainEventBus, {
      trustEventId: trustEvent.id,
      approvalTaskId: task.id,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      riskScore: evaluation.riskScore,
      decision: "REQUIRE_APPROVAL",
      eventType: "approval.request.created"
    });

    return {
      ok: false,
      trustEventId: trustEvent.id,
      decision: "REQUIRE_APPROVAL",
      approvalTaskId: task.id,
      error: "trust_approval_required",
      riskScore: evaluation.riskScore,
      reasons: evaluation.reasons
    };
  }

  return {
    ok: true,
    trustEventId: trustEvent.id,
    decision: evaluation.decision === "FLAG" ? "FLAG" : "ALLOW"
  };
}

export async function buildStaffTrustContext(
  prisma: PrismaClient,
  actorUserId: string,
  restaurantId: string
): Promise<{
  actorContext: "STAFF" | "CUSTOMER";
  actorMembershipRole: string | null;
}> {
  const staff = await actorIsVenueStaff(prisma, actorUserId, restaurantId);
  return {
    actorContext: staff.isStaff ? "STAFF" : "CUSTOMER",
    actorMembershipRole: staff.role
  };
}

async function emitTrustDomainEvent(
  bus: EventEmitter | undefined,
  data: Record<string, unknown>
) {
  if (!bus) return;
  const eventType = (data.eventType as string) ?? "fraud.risk.detected";
  await publishDomainEvent(bus, {
    id: crypto.randomUUID(),
    type: eventType as never,
    occurredAt: new Date().toISOString(),
    restaurantId: (data.workspaceId as string) ?? null,
    actorUserId: (data.actorUserId as string) ?? null,
    payload: data
  });
}

export function trustGuardHttpError(outcome: Extract<TrustGuardOutcome, { ok: false }>) {
  const err = Object.assign(new Error(outcome.error), {
    statusCode: outcome.decision === "BLOCK" ? 403 : 409,
    meta: {
      trustEventId: outcome.trustEventId,
      approvalTaskId: outcome.approvalTaskId,
      riskScore: outcome.riskScore,
      reasons: outcome.reasons,
      decision: outcome.decision
    }
  });
  return err;
}
