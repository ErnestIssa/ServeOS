import type { PrismaClient } from "@prisma/client";
import { getImportExportCatalog } from "./importExportCatalog.js";

function serializeRequest(row: {
  id: string;
  restaurantId: string;
  providerKey: string;
  providerLabel: string | null;
  note: string | null;
  status: string;
  requestedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    providerKey: row.providerKey,
    providerLabel: row.providerLabel,
    note: row.note,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export type CreateMigrationRequestInput = {
  restaurantId: string;
  providerKey: string;
  note?: string | null;
  requestedByUserId?: string | null;
};

export async function createDataTransferMigrationRequest(
  prisma: PrismaClient,
  input: CreateMigrationRequestInput
) {
  const catalog = getImportExportCatalog();
  const provider = catalog.migrationProviders.find((p) => p.key === input.providerKey);
  const providerKey = input.providerKey.trim() || "custom-csv";
  const providerLabel =
    provider?.label ??
    (providerKey === "manual" || providerKey === "request-manual" ? "Manual assistance" : providerKey);

  const note = input.note?.trim() || null;
  if (note && note.length > 4000) {
    return { ok: false as const, error: "note_too_long" as const };
  }

  const row = await prisma.dataTransferMigrationRequest.create({
    data: {
      restaurantId: input.restaurantId,
      providerKey,
      providerLabel,
      note,
      status: "PENDING",
      requestedByUserId: input.requestedByUserId ?? null
    }
  });

  return { ok: true as const, request: serializeRequest(row) };
}

export async function listDataTransferMigrationRequests(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { limit?: number }
) {
  const rows = await prisma.dataTransferMigrationRequest.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts?.limit ?? 20, 1), 100)
  });
  return rows.map(serializeRequest);
}
