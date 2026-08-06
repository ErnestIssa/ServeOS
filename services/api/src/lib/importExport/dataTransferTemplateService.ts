import type { DataTransferTemplateStatus, PrismaClient } from "@prisma/client";
import { findImportExportTarget } from "./importExportCatalog.js";

export const MENU_CSV_TEMPLATE_BODY = `category,item,description,price_cents,sort_order,active,modifier_group,modifier_option,option_price_delta_cents
Starters,Soup of the day,Seasonal soup,8900,1,yes,,,
Mains,House burger,Served with fries,14900,1,yes,Extras,Extra cheese,2000
`;

const CUSTOMERS_CSV_HEADER = `external_id,full_name,email,phone,notes
`;

const STAFF_CSV_HEADER = `external_id,full_name,email,role,active
`;

const INVENTORY_CSV_HEADER = `sku,name,quantity,unit,notes
`;

type DefaultSeed = {
  systemKey: string;
  name: string;
  description: string;
  targetKey: string;
  content: string;
  status: DataTransferTemplateStatus;
};

const DEFAULT_SEEDS: DefaultSeed[] = [
  {
    systemKey: "menu-v1",
    name: "Menu import template",
    description: "Categories, items, modifiers, and prices as a flat CSV catalog.",
    targetKey: "menu",
    content: MENU_CSV_TEMPLATE_BODY,
    status: "ACTIVE"
  },
  {
    systemKey: "customers-v1",
    name: "Customer import template",
    description: "Customer profiles and supported attributes.",
    targetKey: "customers",
    content: CUSTOMERS_CSV_HEADER,
    status: "DRAFT"
  },
  {
    systemKey: "staff-v1",
    name: "Staff import template",
    description: "Staff accounts and role assignments.",
    targetKey: "staff",
    content: STAFF_CSV_HEADER,
    status: "DRAFT"
  },
  {
    systemKey: "inventory-v1",
    name: "Inventory import template",
    description: "Products, stock levels, and inventory metadata.",
    targetKey: "inventory",
    content: INVENTORY_CSV_HEADER,
    status: "DRAFT"
  }
];

function serializeTemplate(row: {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  targetKey: string;
  format: string;
  version: number;
  status: DataTransferTemplateStatus;
  content: string;
  systemKey: string | null;
  isSystem: boolean;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const target = findImportExportTarget(row.targetKey);
  const lineCount = row.content.split(/\r?\n/).filter((l) => l.trim()).length;
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    description: row.description,
    targetKey: row.targetKey,
    targetLabel: target?.label ?? row.targetKey,
    format: row.format,
    version: row.version,
    status: row.status,
    content: row.content,
    systemKey: row.systemKey,
    isSystem: row.isSystem,
    rowEstimate: Math.max(0, lineCount - 1),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export type SerializedDataTransferTemplate = ReturnType<typeof serializeTemplate>;

export async function ensureDefaultTransferTemplates(prisma: PrismaClient, restaurantId: string) {
  for (const seed of DEFAULT_SEEDS) {
    await prisma.dataTransferTemplate.upsert({
      where: {
        restaurantId_systemKey: { restaurantId, systemKey: seed.systemKey }
      },
      create: {
        restaurantId,
        name: seed.name,
        description: seed.description,
        targetKey: seed.targetKey,
        format: "csv",
        version: 1,
        status: seed.status,
        content: seed.content,
        systemKey: seed.systemKey,
        isSystem: true
      },
      update: {}
    });
  }
}

export async function listDataTransferTemplates(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { includeArchived?: boolean }
) {
  await ensureDefaultTransferTemplates(prisma, restaurantId);
  const rows = await prisma.dataTransferTemplate.findMany({
    where: {
      restaurantId,
      ...(opts?.includeArchived ? {} : { status: { not: "ARCHIVED" } })
    },
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }]
  });
  return rows.map(serializeTemplate);
}

export async function getDataTransferTemplate(
  prisma: PrismaClient,
  restaurantId: string,
  templateId: string
) {
  const row = await prisma.dataTransferTemplate.findFirst({
    where: { id: templateId, restaurantId }
  });
  return row ? serializeTemplate(row) : null;
}

export type CreateDataTransferTemplateInput = {
  restaurantId: string;
  name: string;
  description?: string | null;
  targetKey: string;
  format?: string;
  content: string;
  status?: DataTransferTemplateStatus;
  createdByUserId?: string | null;
};

export async function createDataTransferTemplate(
  prisma: PrismaClient,
  input: CreateDataTransferTemplateInput
) {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, error: "invalid_name" as const };
  const content = input.content ?? "";
  if (!content.trim()) return { ok: false as const, error: "invalid_content" as const };
  const format = (input.format ?? "csv").trim().toLowerCase() || "csv";
  if (format !== "csv") return { ok: false as const, error: "format_unavailable" as const };

  const target = findImportExportTarget(input.targetKey);
  if (!target) return { ok: false as const, error: "target_unavailable" as const };

  const row = await prisma.dataTransferTemplate.create({
    data: {
      restaurantId: input.restaurantId,
      name,
      description: input.description?.trim() || null,
      targetKey: input.targetKey,
      format,
      version: 1,
      status: input.status ?? "ACTIVE",
      content,
      isSystem: false,
      createdByUserId: input.createdByUserId ?? null,
      updatedByUserId: input.createdByUserId ?? null
    }
  });
  return { ok: true as const, template: serializeTemplate(row) };
}

export type UpdateDataTransferTemplateInput = {
  name?: string;
  description?: string | null;
  targetKey?: string;
  format?: string;
  content?: string;
  status?: DataTransferTemplateStatus;
  updatedByUserId?: string | null;
};

export async function updateDataTransferTemplate(
  prisma: PrismaClient,
  restaurantId: string,
  templateId: string,
  input: UpdateDataTransferTemplateInput
) {
  const existing = await prisma.dataTransferTemplate.findFirst({
    where: { id: templateId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "template_not_found" as const };

  if (input.targetKey) {
    const target = findImportExportTarget(input.targetKey);
    if (!target) return { ok: false as const, error: "target_unavailable" as const };
  }
  if (input.format && input.format.trim().toLowerCase() !== "csv") {
    return { ok: false as const, error: "format_unavailable" as const };
  }
  if (input.name !== undefined && input.name.trim().length < 2) {
    return { ok: false as const, error: "invalid_name" as const };
  }
  if (input.content !== undefined && !input.content.trim()) {
    return { ok: false as const, error: "invalid_content" as const };
  }

  const bumpVersion =
    (input.content !== undefined && input.content !== existing.content) ||
    (input.targetKey !== undefined && input.targetKey !== existing.targetKey);

  const row = await prisma.dataTransferTemplate.update({
    where: { id: templateId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.targetKey !== undefined ? { targetKey: input.targetKey } : {}),
      ...(input.format !== undefined ? { format: input.format.trim().toLowerCase() } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(bumpVersion ? { version: existing.version + 1 } : {}),
      updatedByUserId: input.updatedByUserId ?? existing.updatedByUserId
    }
  });
  return { ok: true as const, template: serializeTemplate(row) };
}

export async function duplicateDataTransferTemplate(
  prisma: PrismaClient,
  restaurantId: string,
  templateId: string,
  actorUserId?: string | null
) {
  const existing = await prisma.dataTransferTemplate.findFirst({
    where: { id: templateId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "template_not_found" as const };

  const baseName = `${existing.name} copy`;
  let name = baseName;
  let n = 2;
  while (
    await prisma.dataTransferTemplate.findFirst({
      where: { restaurantId, name, status: { not: "ARCHIVED" } },
      select: { id: true }
    })
  ) {
    name = `${baseName} ${n}`;
    n += 1;
  }

  const row = await prisma.dataTransferTemplate.create({
    data: {
      restaurantId,
      name,
      description: existing.description,
      targetKey: existing.targetKey,
      format: existing.format,
      version: 1,
      status: existing.status === "ARCHIVED" ? "DRAFT" : existing.status,
      content: existing.content,
      isSystem: false,
      createdByUserId: actorUserId ?? null,
      updatedByUserId: actorUserId ?? null
    }
  });
  return { ok: true as const, template: serializeTemplate(row) };
}

export async function deleteDataTransferTemplate(
  prisma: PrismaClient,
  restaurantId: string,
  templateId: string
) {
  const existing = await prisma.dataTransferTemplate.findFirst({
    where: { id: templateId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "template_not_found" as const };
  if (existing.isSystem) return { ok: false as const, error: "system_template_locked" as const };

  await prisma.dataTransferTemplate.delete({ where: { id: templateId } });
  return { ok: true as const, id: templateId };
}

export async function archiveDataTransferTemplate(
  prisma: PrismaClient,
  restaurantId: string,
  templateId: string,
  updatedByUserId?: string | null
) {
  return updateDataTransferTemplate(prisma, restaurantId, templateId, {
    status: "ARCHIVED",
    updatedByUserId
  });
}
