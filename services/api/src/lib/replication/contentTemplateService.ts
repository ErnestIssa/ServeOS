import type { PrismaClient } from "@prisma/client";
import { asJson } from "./replicationTypes.js";
import { buildMenuTemplateSnapshot } from "./strategies/duplicateMenuStrategy.js";
import { enqueueReplicationJob } from "./replicationJobService.js";
import { nextUniqueCopyName } from "../menu/menuDuplicateService.js";

export async function saveMenuAsTemplate(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    menuId: string;
    actorUserId: string;
    name?: string;
    description?: string;
  }
) {
  const menu = await prisma.menu.findFirst({
    where: { id: params.menuId, restaurantId: params.restaurantId },
    select: { id: true, name: true, restaurant: { select: { companyId: true } } }
  });
  if (!menu) return { ok: false as const, error: "menu_not_found" };

  const snapshot = await buildMenuTemplateSnapshot(prisma, params.restaurantId, params.menuId);
  if (!snapshot) return { ok: false as const, error: "menu_not_found" };

  const name =
    params.name?.trim() ||
    (await nextUniqueCopyName(prisma, `${menu.name} Template`, async (n) => {
      const hit = await prisma.contentTemplate.findFirst({
        where: { restaurantId: params.restaurantId, name: { equals: n, mode: "insensitive" } },
        select: { id: true }
      });
      return Boolean(hit);
    }));

  const template = await prisma.contentTemplate.create({
    data: {
      restaurantId: params.restaurantId,
      companyId: menu.restaurant.companyId,
      kind: "MENU",
      name,
      description: params.description?.trim() || null,
      snapshot: asJson(snapshot),
      createdByUserId: params.actorUserId
    }
  });

  return {
    ok: true as const,
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      kind: template.kind,
      restaurantId: template.restaurantId,
      companyId: template.companyId,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    }
  };
}

export async function listContentTemplates(prisma: PrismaClient, restaurantId: string) {
  const venue = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, companyId: true }
  });
  if (!venue) return [];

  const rows = await prisma.contentTemplate.findMany({
    where: {
      kind: "MENU",
      OR: [
        { restaurantId },
        ...(venue.companyId ? [{ companyId: venue.companyId }] : [])
      ]
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    kind: t.kind,
    restaurantId: t.restaurantId,
    companyId: t.companyId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  }));
}

export async function enqueueApplyTemplate(
  prisma: PrismaClient,
  params: {
    templateId: string;
    actorUserId: string;
    targetRestaurantId: string;
    name?: string;
  }
) {
  const template = await prisma.contentTemplate.findUnique({ where: { id: params.templateId } });
  if (!template) return { ok: false as const, error: "template_not_found" };

  const job = await enqueueReplicationJob(prisma, {
    kind: "APPLY_TEMPLATE",
    sourceRestaurantId: template.restaurantId,
    targetRestaurantId: params.targetRestaurantId,
    actorUserId: params.actorUserId,
    payload: {
      templateId: template.id,
      targetRestaurantId: params.targetRestaurantId,
      name: params.name
    }
  });

  return { ok: true as const, jobId: job.id };
}

export async function deleteContentTemplate(
  prisma: PrismaClient,
  params: { templateId: string; restaurantId: string }
) {
  const t = await prisma.contentTemplate.findFirst({
    where: { id: params.templateId, restaurantId: params.restaurantId }
  });
  if (!t) return { ok: false as const, error: "template_not_found" };
  await prisma.contentTemplate.delete({ where: { id: t.id } });
  return { ok: true as const };
}
