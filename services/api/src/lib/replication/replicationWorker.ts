import type { PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import { asJson } from "./replicationTypes.js";
import {
  rollbackJobEntities
} from "./replicationJobService.js";
import {
  runApplyTemplateJob,
  runDuplicateMenuJob
} from "./strategies/duplicateMenuStrategy.js";
import { duplicateUsage } from "./mediaAssetService.js";
import type {
  ApplyTemplateJobPayload,
  DuplicateMediaUsageJobPayload,
  DuplicateMenuJobPayload,
  DuplicateToLocationJobPayload
} from "./replicationTypes.js";

const DEFAULT_INTERVAL_MS = 2_500;

export function startReplicationWorker(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  intervalMs = DEFAULT_INTERVAL_MS
) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processNextReplicationJob(prisma, log);
    } catch (err) {
      log.error({ err }, "replication_worker_tick_failed");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  void tick();

  return () => clearInterval(timer);
}

export async function processNextReplicationJob(prisma: PrismaClient, log: FastifyBaseLogger) {
  const job = await prisma.replicationJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" }
  });
  if (!job) return;

  const claimed = await prisma.replicationJob.updateMany({
    where: { id: job.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), phase: "running", progressPct: 1 }
  });
  if (claimed.count === 0) return;

  log.info({ jobId: job.id, kind: job.kind }, "replication_job_started");

  try {
    let result: Record<string, unknown> = {};

    if (job.kind === "DUPLICATE_MENU" || job.kind === "DUPLICATE_TO_LOCATION") {
      const payload = job.payload as DuplicateMenuJobPayload & Partial<DuplicateToLocationJobPayload>;
      const targetRestaurantId =
        job.kind === "DUPLICATE_TO_LOCATION"
          ? (payload.targetRestaurantId ?? job.targetRestaurantId)
          : job.sourceRestaurantId;
      if (!targetRestaurantId) throw new Error("target_restaurant_required");

      const out = await runDuplicateMenuJob(prisma, {
        jobId: job.id,
        sourceRestaurantId: job.sourceRestaurantId,
        targetRestaurantId,
        actorUserId: job.actorUserId,
        payload
      });
      result = out;
      log.info(
        {
          audit: {
            action: job.kind === "DUPLICATE_TO_LOCATION" ? "menu.duplicated_to_location" : "menu.duplicated",
            sourceId: payload.menuId,
            newId: out.newMenuId,
            actorUserId: job.actorUserId,
            jobId: job.id
          }
        },
        "menu.duplicated"
      );
    } else if (job.kind === "APPLY_TEMPLATE") {
      const payload = job.payload as ApplyTemplateJobPayload;
      const targetRestaurantId = payload.targetRestaurantId ?? job.targetRestaurantId;
      if (!targetRestaurantId) throw new Error("target_restaurant_required");
      const out = await runApplyTemplateJob(prisma, {
        jobId: job.id,
        targetRestaurantId,
        actorUserId: job.actorUserId,
        payload
      });
      result = out;
      log.info(
        {
          audit: {
            action: "template.applied",
            sourceId: payload.templateId,
            newId: out.newMenuId,
            actorUserId: job.actorUserId,
            jobId: job.id
          }
        },
        "template.applied"
      );
    } else if (job.kind === "DUPLICATE_MEDIA_USAGE") {
      const payload = job.payload as DuplicateMediaUsageJobPayload;
      const out = await duplicateUsage(prisma, {
        assetId: payload.assetId,
        restaurantId: job.sourceRestaurantId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        role: payload.role,
        sortOrder: payload.sortOrder,
        actorUserId: job.actorUserId
      });
      if (!out.ok) throw new Error(out.error);
      result = { usageId: out.usage.id, assetId: out.asset.id };
    } else {
      throw new Error(`unsupported_job_kind:${job.kind}`);
    }

    await prisma.replicationJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        progressPct: 100,
        phase: "completed",
        result: asJson(result),
        finishedAt: new Date()
      }
    });
    log.info({ jobId: job.id, result }, "duplicate.completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "replication_failed";
    log.error({ err, jobId: job.id }, "duplicate.failed");
    try {
      await rollbackJobEntities(prisma, job.id);
    } catch (rollbackErr) {
      log.error({ err: rollbackErr, jobId: job.id }, "replication_rollback_failed");
    }
    await prisma.replicationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        phase: "failed",
        error: message.slice(0, 500),
        finishedAt: new Date()
      }
    });
  }
}
