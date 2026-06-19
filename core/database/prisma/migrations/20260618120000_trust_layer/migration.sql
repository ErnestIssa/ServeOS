-- Trust Layer + Order ownership context

CREATE TYPE "OrderCreatedContext" AS ENUM ('CUSTOMER', 'STAFF');
CREATE TYPE "TrustEventType" AS ENUM ('FRAUD_DETECTED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED', 'EXECUTED', 'BLOCKED', 'AUDIT_LOG');
CREATE TYPE "TrustEntityType" AS ENUM ('ORDER', 'PAYMENT', 'USER', 'MENU', 'STAFF', 'SHIFT');
CREATE TYPE "TrustActionType" AS ENUM ('DISCOUNT', 'REFUND', 'COMP', 'ORDER_EDIT', 'ORDER_CANCEL', 'ORDER_STATUS', 'PRICE_EDIT', 'ROLE_CHANGE', 'PERMISSION_CHANGE');
CREATE TYPE "TrustActorContext" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');
CREATE TYPE "TrustDecision" AS ENUM ('ALLOW', 'REQUIRE_APPROVAL', 'BLOCK', 'FLAG');
CREATE TYPE "TrustEventStatus" AS ENUM ('PENDING', 'RESOLVED', 'FINAL');
CREATE TYPE "FraudDetectorType" AS ENUM ('COI_DETECTED', 'DISCOUNT_ABUSE', 'REFUND_ABUSE', 'VELOCITY_ANOMALY', 'ROLE_ABUSE', 'IDENTITY_SWITCHING', 'COLLUSION', 'SHIFT_ANOMALY', 'PRICE_MANIPULATION');
CREATE TYPE "ApprovalTaskStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'ESCALATED');
CREATE TYPE "ApprovalRequiredRole" AS ENUM ('MANAGER', 'OWNER', 'SHIFT_LEAD', 'INDEPENDENT_STAFF');
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVE', 'REJECT', 'ESCALATE');

ALTER TABLE "Order" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "createdByContext" "OrderCreatedContext" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Order_createdByUserId_idx" ON "Order"("createdByUserId");

UPDATE "Order" SET "createdByUserId" = "customerUserId" WHERE "customerUserId" IS NOT NULL;

CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TrustEventType" NOT NULL,
    "entityType" "TrustEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" "TrustActionType" NOT NULL,
    "context" "TrustActorContext" NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "decision" "TrustDecision" NOT NULL,
    "status" "TrustEventStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FraudSignal" (
    "id" TEXT NOT NULL,
    "trustEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detectorType" "FraudDetectorType" NOT NULL,
    "severity" INTEGER NOT NULL,
    "reason" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FraudSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FraudScore" (
    "id" TEXT NOT NULL,
    "trustEventId" TEXT NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "decision" "TrustDecision" NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FraudScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalTask" (
    "id" TEXT NOT NULL,
    "trustEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" "TrustEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requiredRole" "ApprovalRequiredRole" NOT NULL,
    "status" "ApprovalTaskStatus" NOT NULL DEFAULT 'PENDING',
    "riskScore" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "approvalTaskId" TEXT NOT NULL,
    "actedByUserId" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrustAuditLog" (
    "id" TEXT NOT NULL,
    "trustEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actionType" "TrustActionType" NOT NULL,
    "entityType" "TrustEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrustActionVelocity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrustActionVelocity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FraudScore_trustEventId_key" ON "FraudScore"("trustEventId");
CREATE UNIQUE INDEX "ApprovalTask_trustEventId_key" ON "ApprovalTask"("trustEventId");
CREATE UNIQUE INDEX "TrustActionVelocity_workspaceId_userId_actionType_key" ON "TrustActionVelocity"("workspaceId", "userId", "actionType");

CREATE INDEX "TrustEvent_workspaceId_createdAt_idx" ON "TrustEvent"("workspaceId", "createdAt");
CREATE INDEX "TrustEvent_userId_createdAt_idx" ON "TrustEvent"("userId", "createdAt");
CREATE INDEX "TrustEvent_entityType_entityId_idx" ON "TrustEvent"("entityType", "entityId");
CREATE INDEX "TrustEvent_type_status_idx" ON "TrustEvent"("type", "status");

CREATE INDEX "FraudSignal_trustEventId_idx" ON "FraudSignal"("trustEventId");
CREATE INDEX "FraudSignal_workspaceId_detectorType_idx" ON "FraudSignal"("workspaceId", "detectorType");
CREATE INDEX "FraudSignal_userId_createdAt_idx" ON "FraudSignal"("userId", "createdAt");

CREATE INDEX "ApprovalTask_workspaceId_status_idx" ON "ApprovalTask"("workspaceId", "status");
CREATE INDEX "ApprovalTask_requestedByUserId_idx" ON "ApprovalTask"("requestedByUserId");
CREATE INDEX "ApprovalTask_expiresAt_idx" ON "ApprovalTask"("expiresAt");

CREATE INDEX "ApprovalAction_approvalTaskId_idx" ON "ApprovalAction"("approvalTaskId");
CREATE INDEX "ApprovalAction_actedByUserId_idx" ON "ApprovalAction"("actedByUserId");

CREATE INDEX "TrustAuditLog_workspaceId_createdAt_idx" ON "TrustAuditLog"("workspaceId", "createdAt");
CREATE INDEX "TrustAuditLog_entityType_entityId_idx" ON "TrustAuditLog"("entityType", "entityId");
CREATE INDEX "TrustAuditLog_actorId_idx" ON "TrustAuditLog"("actorId");

CREATE INDEX "TrustActionVelocity_workspaceId_userId_idx" ON "TrustActionVelocity"("workspaceId", "userId");

ALTER TABLE "FraudSignal" ADD CONSTRAINT "FraudSignal_trustEventId_fkey" FOREIGN KEY ("trustEventId") REFERENCES "TrustEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FraudScore" ADD CONSTRAINT "FraudScore_trustEventId_fkey" FOREIGN KEY ("trustEventId") REFERENCES "TrustEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_trustEventId_fkey" FOREIGN KEY ("trustEventId") REFERENCES "TrustEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approvalTaskId_fkey" FOREIGN KEY ("approvalTaskId") REFERENCES "ApprovalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustAuditLog" ADD CONSTRAINT "TrustAuditLog_trustEventId_fkey" FOREIGN KEY ("trustEventId") REFERENCES "TrustEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
