import type { PrismaClient, ReplicationJobKind } from "@prisma/client";
import { asJson, type ReplicationJobPayload, type ReplicationProgressCounts } from "./replicationTypes.js";

export async function enqueueReplicationJob(
  prisma: PrismaClient,
  input: {
    kind: ReplicationJobKind;
    sourceRestaurantId: string;
    targetRestaurantId?: string | null;
    actorUserId: string;
    payload: ReplicationJobPayload;
  }
) {
  const job = await prisma.replicationJob.create({
    data: {
      kind: input.kind,
      status: "QUEUED",
      sourceRestaurantId: input.sourceRestaurantId,
      targetRestaurantId: input.targetRestaurantId ?? null,
      actorUserId: input.actorUserId,
      payload: asJson(input.payload),
      progressPct: 0,
      phase: "queued"
    }
  });
  return job;
}

export async function getReplicationJob(prisma: PrismaClient, jobId: string) {
  return prisma.replicationJob.findUnique({
    where: { id: jobId },
    include: { mapEntries: { take: 5 } }
  });
}

export function serializeReplicationJob(
  job: NonNullable<Awaited<ReturnType<typeof getReplicationJob>>>
) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    sourceRestaurantId: job.sourceRestaurantId,
    targetRestaurantId: job.targetRestaurantId,
    actorUserId: job.actorUserId,
    payload: job.payload,
    progressPct: job.progressPct,
    phase: job.phase,
    counts: job.counts,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null
  };
}

export async function listReplicationJobs(
  prisma: PrismaClient,
  restaurantId: string,
  limit = 20
) {
  const rows = await prisma.replicationJob.findMany({
    where: {
      OR: [{ sourceRestaurantId: restaurantId }, { targetRestaurantId: restaurantId }]
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return rows.map((j) => serializeReplicationJob({ ...j, mapEntries: [] }));
}

export async function cancelReplicationJob(prisma: PrismaClient, jobId: string, actorUserId: string) {
  const job = await prisma.replicationJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false as const, error: "job_not_found" };
  if (job.actorUserId !== actorUserId) return { ok: false as const, error: "forbidden" };
  if (job.status !== "QUEUED") return { ok: false as const, error: "job_not_cancellable" };
  const updated = await prisma.replicationJob.update({
    where: { id: jobId },
    data: { status: "CANCELLED", finishedAt: new Date(), phase: "cancelled" }
  });
  return { ok: true as const, job: serializeReplicationJob({ ...updated, mapEntries: [] }) };
}

export async function updateJobProgress(
  prisma: PrismaClient,
  jobId: string,
  patch: {
    progressPct?: number;
    phase?: string;
    counts?: ReplicationProgressCounts;
  }
) {
  await prisma.replicationJob.update({
    where: { id: jobId },
    data: {
      ...(patch.progressPct !== undefined ? { progressPct: Math.max(0, Math.min(100, patch.progressPct)) } : {}),
      ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
      ...(patch.counts !== undefined ? { counts: asJson(patch.counts) } : {})
    }
  });
}

export async function recordMapEntry(
  prisma: PrismaClient,
  jobId: string,
  entityType: string,
  sourceId: string,
  targetId: string
) {
  await prisma.replicationMap.create({
    data: { jobId, entityType, sourceId, targetId }
  });
}

export async function rollbackJobEntities(prisma: PrismaClient, jobId: string) {
  const entries = await prisma.replicationMap.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" }
  });

  for (const entry of entries) {
    try {
      switch (entry.entityType) {
        case "menu":
          await prisma.menu.deleteMany({ where: { id: entry.targetId } });
          break;
        case "category":
          await prisma.menuCategory.deleteMany({ where: { id: entry.targetId } });
          break;
        case "item":
          await prisma.menuItem.deleteMany({ where: { id: entry.targetId } });
          break;
        case "modifier_group":
          await prisma.modifierGroup.deleteMany({ where: { id: entry.targetId } });
          break;
        case "modifier_option":
          await prisma.modifierOption.deleteMany({ where: { id: entry.targetId } });
          break;
        case "stored_media":
          await prisma.storedMedia.deleteMany({ where: { id: entry.targetId } });
          break;
        case "media_usage":
          await prisma.mediaUsage.deleteMany({ where: { id: entry.targetId } });
          break;
        default:
          break;
      }
    } catch {
      /* continue cleanup */
    }
  }

  await prisma.replicationMap.deleteMany({ where: { jobId } });
}
