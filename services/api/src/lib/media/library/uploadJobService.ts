import type { PrismaClient } from "@prisma/client";
import { runPostUploadHooks } from "./processingHooks.js";

const STAGES = ["queued", "uploading", "hashing", "thumbnail_meta", "cdn", "ready"] as const;

export async function createUploadJob(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    createdByUserId?: string;
    originalName?: string;
    contentType?: string;
    purpose?: string;
  }
) {
  const job = await prisma.mediaUploadJob.create({
    data: {
      restaurantId: params.restaurantId,
      createdByUserId: params.createdByUserId ?? null,
      originalName: params.originalName ?? null,
      contentType: params.contentType ?? null,
      purpose: params.purpose ?? null,
      status: "QUEUED",
      stage: "queued",
      progress: 0
    }
  });
  return job;
}

export async function getUploadJob(prisma: PrismaClient, restaurantId: string, jobId: string) {
  return prisma.mediaUploadJob.findFirst({
    where: { id: jobId, restaurantId }
  });
}

export async function listUploadJobs(prisma: PrismaClient, restaurantId: string, limit = 40) {
  return prisma.mediaUploadJob.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function advanceUploadJob(
  prisma: PrismaClient,
  jobId: string,
  patch: {
    status?: "QUEUED" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
    stage?: string;
    progress?: number;
    assetId?: string | null;
    error?: string | null;
    objectKey?: string | null;
  }
) {
  return prisma.mediaUploadJob.update({
    where: { id: jobId },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.stage ? { stage: patch.stage } : {}),
      ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
      ...(patch.assetId !== undefined ? { assetId: patch.assetId } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.objectKey !== undefined ? { objectKey: patch.objectKey } : {})
    }
  });
}

/** Run real post-upload stages (no AI). */
export async function finalizeUploadJobProcessing(
  prisma: PrismaClient,
  params: {
    jobId: string;
    restaurantId: string;
    assetId: string;
    objectKey: string;
    contentType: string;
  }
) {
  await advanceUploadJob(prisma, params.jobId, {
    status: "PROCESSING",
    stage: "hashing",
    progress: 55,
    assetId: params.assetId,
    objectKey: params.objectKey
  });

  await advanceUploadJob(prisma, params.jobId, {
    stage: "thumbnail_meta",
    progress: 75
  });

  await runPostUploadHooks({
    assetId: params.assetId,
    objectKey: params.objectKey,
    contentType: params.contentType,
    restaurantId: params.restaurantId
  });

  await advanceUploadJob(prisma, params.jobId, {
    stage: "cdn",
    progress: 90
  });

  return advanceUploadJob(prisma, params.jobId, {
    status: "READY",
    stage: "ready",
    progress: 100
  });
}

export function serializeUploadJob(job: {
  id: string;
  restaurantId: string;
  status: string;
  stage: string;
  progress: number;
  assetId: string | null;
  error: string | null;
  originalName: string | null;
  contentType: string | null;
  purpose: string | null;
  objectKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    restaurantId: job.restaurantId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    assetId: job.assetId,
    error: job.error,
    originalName: job.originalName,
    contentType: job.contentType,
    purpose: job.purpose,
    objectKey: job.objectKey,
    stages: [...STAGES],
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
