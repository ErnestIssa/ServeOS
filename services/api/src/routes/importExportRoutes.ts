import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  findImportExportTarget,
  getImportExportCatalog
} from "../lib/importExport/importExportCatalog.js";
import {
  completeDataTransferJob,
  createDataTransferJob,
  getDataTransferJob,
  listDataTransferJobs
} from "../lib/importExport/dataTransferJobService.js";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import { assertMenuEntityPermission } from "../lib/menu/menuPermissions.js";
import {
  exportMenuCsv,
  importMenuCsv,
  mapImportExportError,
  previewMenuCsv
} from "../lib/menu/menuImportExportService.js";

export function registerImportExportRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/import-export/catalog", async (req) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "view", membership);
    return { ok: true, catalog: getImportExportCatalog() };
  });

  app.get("/restaurants/:restaurantId/import-export/jobs", async (req) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        direction: z.enum(["IMPORT", "EXPORT"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional()
      })
      .parse(req.query ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "view", membership);

    const jobs = await listDataTransferJobs(prisma, restaurantId, {
      direction: query.direction,
      limit: query.limit
    });
    return { ok: true, jobs };
  });

  app.get("/restaurants/:restaurantId/import-export/jobs/:jobId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), jobId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "view", membership);

    const job = await getDataTransferJob(prisma, params.restaurantId, params.jobId);
    if (!job) return reply.status(404).send({ ok: false, error: "job_not_found", message: "Job not found." });
    return { ok: true, job };
  });

  app.get("/restaurants/:restaurantId/import-export/exports/:targetKey", async (req, reply) => {
    const params = z
      .object({
        restaurantId: z.string().min(1),
        targetKey: z.string().min(1)
      })
      .parse(req.params);
    const query = z.object({ format: z.string().default("csv") }).parse(req.query ?? {});
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);

    const target = findImportExportTarget(params.targetKey);
    if (!target || target.availability !== "available" || !target.directions.includes("export")) {
      return reply.status(400).send({
        ok: false,
        error: "target_unavailable",
        message: mapImportExportError("target_unavailable")
      });
    }
    if (!target.formats.includes(query.format)) {
      return reply.status(400).send({
        ok: false,
        error: "format_unavailable",
        message: mapImportExportError("format_unavailable")
      });
    }

    assertMenuEntityPermission(target.permissionEntity, "view", membership);

    if (params.targetKey === "menu" && query.format === "csv") {
      const job = await createDataTransferJob(prisma, {
        restaurantId: params.restaurantId,
        direction: "EXPORT",
        targetKey: "menu",
        sourceFormat: "csv",
        fileName: `menu-${params.restaurantId}.csv`,
        startedByUserId: userId,
        status: "RUNNING"
      });

      try {
        const csv = await exportMenuCsv(prisma, params.restaurantId);
        const rowCount = Math.max(0, csv.split(/\r?\n/).filter((l) => l.trim()).length - 1);
        await completeDataTransferJob(prisma, job.id, {
          status: "COMPLETED",
          rowCount,
          importedCount: rowCount,
          summary: { format: "csv", bytes: Buffer.byteLength(csv, "utf8") }
        });
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", `attachment; filename="menu-${params.restaurantId}.csv"`);
        reply.header("X-ServeOS-Transfer-Job-Id", job.id);
        return reply.send(csv);
      } catch (err) {
        await completeDataTransferJob(prisma, job.id, {
          status: "FAILED",
          error: err instanceof Error ? err.message : "export_failed"
        });
        throw err;
      }
    }

    return reply.status(400).send({
      ok: false,
      error: "target_unavailable",
      message: mapImportExportError("target_unavailable")
    });
  });

  app.post("/restaurants/:restaurantId/import-export/imports/:targetKey/preview", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), targetKey: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        csv: z.string().min(1),
        sourceFormat: z.string().default("csv"),
        fileName: z.string().max(240).optional()
      })
      .parse(req.body);
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);

    const target = findImportExportTarget(params.targetKey);
    if (!target || target.availability !== "available" || !target.directions.includes("import")) {
      return reply.status(400).send({
        ok: false,
        error: "target_unavailable",
        message: mapImportExportError("target_unavailable")
      });
    }
    assertMenuEntityPermission(target.permissionEntity, "edit", membership);

    if (params.targetKey !== "menu" || body.sourceFormat !== "csv") {
      return reply.status(400).send({
        ok: false,
        error: "format_unavailable",
        message: mapImportExportError("format_unavailable")
      });
    }

    const job = await createDataTransferJob(prisma, {
      restaurantId: params.restaurantId,
      direction: "IMPORT",
      targetKey: "menu",
      sourceFormat: "csv",
      fileName: body.fileName ?? null,
      dryRun: true,
      startedByUserId: userId,
      status: "VALIDATING"
    });

    const result = await previewMenuCsv(body.csv);
    if (!result.ok) {
      await completeDataTransferJob(prisma, job.id, {
        status: "FAILED",
        error: result.error,
        summary: { message: mapImportExportError(result.error) }
      });
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapImportExportError(result.error),
        jobId: job.id
      });
    }

    await completeDataTransferJob(prisma, job.id, {
      status: "COMPLETED",
      rowCount: result.preview.rowCount,
      importedCount: 0,
      skippedCount: 0,
      failedCount: result.preview.errorCount,
      warningCount: result.preview.warningCount,
      summary: { preview: result.preview, dryRun: true }
    });

    return {
      ok: true,
      dryRun: true,
      jobId: job.id,
      preview: result.preview,
      fileHash: result.fileHash,
      fileSizeBytes: result.fileSizeBytes
    };
  });

  app.post("/restaurants/:restaurantId/import-export/imports/:targetKey", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), targetKey: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        csv: z.string().min(1),
        sourceFormat: z.string().default("csv"),
        fileName: z.string().max(240).optional(),
        dryRun: z.boolean().optional(),
        conflictStrategy: z.enum(["skip", "replace", "update", "duplicate", "ask"]).default("skip")
      })
      .parse(req.body);
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);

    const target = findImportExportTarget(params.targetKey);
    if (!target || target.availability !== "available" || !target.directions.includes("import")) {
      return reply.status(400).send({
        ok: false,
        error: "target_unavailable",
        message: mapImportExportError("target_unavailable")
      });
    }
    assertMenuEntityPermission(target.permissionEntity, "edit", membership);

    if (params.targetKey !== "menu" || body.sourceFormat !== "csv") {
      return reply.status(400).send({
        ok: false,
        error: "format_unavailable",
        message: mapImportExportError("format_unavailable")
      });
    }

    // Only skip is implemented for menu CSV today.
    if (body.conflictStrategy !== "skip") {
      return reply.status(400).send({
        ok: false,
        error: "conflict_strategy_unavailable",
        message: "Only Skip existing is available for menu CSV imports today."
      });
    }

    const dryRun = body.dryRun === true;
    const job = await createDataTransferJob(prisma, {
      restaurantId: params.restaurantId,
      direction: "IMPORT",
      targetKey: "menu",
      sourceFormat: "csv",
      fileName: body.fileName ?? null,
      dryRun,
      startedByUserId: userId,
      status: dryRun ? "VALIDATING" : "RUNNING"
    });

    const result = await importMenuCsv(prisma, params.restaurantId, body.csv, { dryRun });
    if (!result.ok) {
      await completeDataTransferJob(prisma, job.id, {
        status: "FAILED",
        error: result.error,
        failedCount: result.preview?.errorCount ?? 0,
        warningCount: result.preview?.warningCount ?? 0,
        summary: { preview: result.preview ?? null, message: mapImportExportError(result.error) }
      });
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapImportExportError(result.error),
        preview: result.preview,
        jobId: job.id
      });
    }

    const importedRows = result.imported?.rows ?? 0;
    const created =
      (result.imported?.categoriesCreated ?? 0) +
      (result.imported?.itemsCreated ?? 0) +
      (result.imported?.modifiersCreated ?? 0);

    await completeDataTransferJob(prisma, job.id, {
      status: "COMPLETED",
      rowCount: result.preview.rowCount,
      importedCount: dryRun ? 0 : created,
      updatedCount: 0,
      skippedCount: result.imported?.skippedExisting ?? 0,
      failedCount: result.preview.errorCount,
      warningCount: result.preview.warningCount,
      summary: {
        dryRun,
        preview: result.preview,
        imported: result.imported,
        conflictStrategy: body.conflictStrategy
      },
      undoAvailable: false
    });

    return {
      ok: true,
      dryRun,
      jobId: job.id,
      preview: result.preview,
      imported: result.imported,
      fileHash: result.fileHash,
      fileSizeBytes: result.fileSizeBytes,
      summary: dryRun
        ? {
            rows: result.preview.rowCount,
            valid: result.preview.validRows,
            warnings: result.preview.warningCount,
            errors: result.preview.errorCount,
            imported: 0
          }
        : {
            rows: importedRows,
            imported: created,
            updated: 0,
            skipped: result.imported?.skippedExisting ?? 0,
            failed: result.preview.errorCount
          }
    };
  });
}
