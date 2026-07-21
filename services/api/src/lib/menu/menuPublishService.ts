import type { PrismaClient } from "@prisma/client";
import { publishMenuRelease, mapMenuReleaseError } from "./menuReleaseService.js";

/** @deprecated Prefer publishMenuRelease — kept as thin wrapper for existing callers. */
export async function publishMenuSurface(
  prisma: PrismaClient,
  params: { restaurantId: string; menuId: string; publishedByUserId: string; releaseNotes?: string | null }
) {
  const result = await publishMenuRelease(prisma, {
    restaurantId: params.restaurantId,
    menuId: params.menuId,
    publishedByUserId: params.publishedByUserId,
    releaseNotes: params.releaseNotes,
    requireChanges: false
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error, validation: result.validation };
  }
  return {
    ok: true as const,
    menu: result.menu,
    report: result.report,
    changeSummary: result.changeSummary
  };
}

export function mapPublishMenuError(code: string): string {
  return mapMenuReleaseError(code);
}
