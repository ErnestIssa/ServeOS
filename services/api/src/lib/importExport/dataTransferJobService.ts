import type { DataTransferDirection, DataTransferJobStatus, Prisma, PrismaClient } from "@prisma/client";

export type CreateDataTransferJobInput = {
  restaurantId: string;
  direction: DataTransferDirection;
  targetKey: string;
  sourceFormat?: string | null;
  fileName?: string | null;
  fileHash?: string | null;
  fileSizeBytes?: number | null;
  dryRun?: boolean;
  startedByUserId?: string | null;
  status?: DataTransferJobStatus;
};

export type CompleteDataTransferJobInput = {
  status: Extract<DataTransferJobStatus, "COMPLETED" | "FAILED" | "CANCELLED" | "ROLLED_BACK">;
  rowCount?: number;
  importedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  warningCount?: number;
  summary?: Prisma.InputJsonValue;
  error?: string | null;
  undoAvailable?: boolean;
  undoExpiresAt?: Date | null;
};

function serializeJob(job: {
  id: string;
  restaurantId: string;
  direction: DataTransferDirection;
  status: DataTransferJobStatus;
  targetKey: string;
  sourceFormat: string | null;
  fileName: string | null;
  fileHash: string | null;
  fileSizeBytes: number | null;
  rowCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  warningCount: number;
  dryRun: boolean;
  summary: Prisma.JsonValue;
  error: string | null;
  startedByUserId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  undoExpiresAt: Date | null;
  undoAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    restaurantId: job.restaurantId,
    direction: job.direction,
    status: job.status,
    targetKey: job.targetKey,
    sourceFormat: job.sourceFormat,
    fileName: job.fileName,
    fileHash: job.fileHash,
    fileSizeBytes: job.fileSizeBytes,
    rowCount: job.rowCount,
    importedCount: job.importedCount,
    updatedCount: job.updatedCount,
    skippedCount: job.skippedCount,
    failedCount: job.failedCount,
    warningCount: job.warningCount,
    dryRun: job.dryRun,
    summary: job.summary,
    error: job.error,
    startedByUserId: job.startedByUserId,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    undoExpiresAt: job.undoExpiresAt?.toISOString() ?? null,
    undoAvailable: job.undoAvailable && (!job.undoExpiresAt || job.undoExpiresAt > new Date()),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

export async function createDataTransferJob(prisma: PrismaClient, input: CreateDataTransferJobInput) {
  const job = await prisma.dataTransferJob.create({
    data: {
      restaurantId: input.restaurantId,
      direction: input.direction,
      targetKey: input.targetKey,
      sourceFormat: input.sourceFormat ?? null,
      fileName: input.fileName ?? null,
      fileHash: input.fileHash ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      dryRun: input.dryRun ?? false,
      startedByUserId: input.startedByUserId ?? null,
      status: input.status ?? "RUNNING"
    }
  });
  return serializeJob(job);
}

export async function completeDataTransferJob(
  prisma: PrismaClient,
  jobId: string,
  input: CompleteDataTransferJobInput
) {
  const undoExpiresAt =
    input.undoExpiresAt === undefined
      ? input.undoAvailable
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null
      : input.undoExpiresAt;

  const job = await prisma.dataTransferJob.update({
    where: { id: jobId },
    data: {
      status: input.status,
      rowCount: input.rowCount ?? 0,
      importedCount: input.importedCount ?? 0,
      updatedCount: input.updatedCount ?? 0,
      skippedCount: input.skippedCount ?? 0,
      failedCount: input.failedCount ?? 0,
      warningCount: input.warningCount ?? 0,
      summary: input.summary ?? undefined,
      error: input.error ?? null,
      finishedAt: new Date(),
      undoAvailable: input.undoAvailable ?? false,
      undoExpiresAt
    }
  });
  return serializeJob(job);
}

export async function listDataTransferJobs(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { direction?: DataTransferDirection; limit?: number }
) {
  const jobs = await prisma.dataTransferJob.findMany({
    where: {
      restaurantId,
      ...(opts?.direction ? { direction: opts.direction } : {})
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  });
  return jobs.map(serializeJob);
}

export async function getDataTransferJob(prisma: PrismaClient, restaurantId: string, jobId: string) {
  const job = await prisma.dataTransferJob.findFirst({
    where: { id: jobId, restaurantId }
  });
  return job ? serializeJob(job) : null;
}

export type SerializedDataTransferJob = ReturnType<typeof serializeJob>;
