import type {
  ApprovalRequiredRole,
  FraudDetectorType,
  TrustActionType,
  TrustActorContext,
  TrustDecision,
  TrustEntityType
} from "@prisma/client";

export type TrustEvaluationInput = {
  workspaceId: string;
  actorUserId: string;
  actorContext: TrustActorContext;
  entityType: TrustEntityType;
  entityId: string;
  actionType: TrustActionType;
  payload?: Record<string, unknown>;
  metadata?: {
    deviceId?: string;
    ipAddress?: string;
    shiftId?: string;
    customerUserId?: string | null;
    orderSubtotalCents?: number;
    orderTotalCents?: number;
    discountCents?: number;
    refundCents?: number;
    targetStatus?: string;
    actorMembershipRole?: string;
  };
};

export type FraudSignalResult = {
  detectorType: FraudDetectorType;
  severity: number;
  reason: Record<string, unknown>;
};

export type TrustEvaluationResult = {
  riskScore: number;
  decision: TrustDecision;
  signals: FraudSignalResult[];
  requiredRole?: ApprovalRequiredRole;
  reasons: string[];
};

export type TrustGuardOutcome =
  | { ok: true; trustEventId: string; decision: "ALLOW" | "FLAG" }
  | {
      ok: false;
      trustEventId: string;
      decision: "BLOCK" | "REQUIRE_APPROVAL";
      approvalTaskId?: string;
      error: string;
      riskScore: number;
      reasons: string[];
    };

export type OrderTrustSnapshot = {
  id: string;
  restaurantId: string;
  customerUserId: string | null;
  createdByUserId: string | null;
  createdByContext: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  refundedCents: number;
  totalCents: number;
};
