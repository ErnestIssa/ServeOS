import type { PrismaClient } from "@prisma/client";

export type VenueHoursPeer = {
  id: string;
  name: string;
  openingHours: string | null;
};

export type VenueHoursPeersResult =
  | {
      ok: true;
      current: VenueHoursPeer;
      peers: VenueHoursPeer[];
    }
  | { ok: false; error: "restaurant_not_found" };

/**
 * Current venue plus other registered venues in the same company or with the same venue subtype.
 * Peers are view-only context for opening hours — no preference switching.
 */
export async function listVenueHoursPeers(
  prisma: PrismaClient,
  restaurantId: string
): Promise<VenueHoursPeersResult> {
  const id = restaurantId.trim();
  if (!id) return { ok: false, error: "restaurant_not_found" };

  const current = await prisma.restaurant.findFirst({
    where: { id, companyId: { not: null } },
    select: {
      id: true,
      name: true,
      openingHours: true,
      companyId: true,
      venueSubtype: true
    }
  });
  if (!current) return { ok: false, error: "restaurant_not_found" };

  const peerFilters: Array<{ companyId?: string; venueSubtype?: string }> = [];
  if (current.companyId) peerFilters.push({ companyId: current.companyId });
  if (current.venueSubtype?.trim()) {
    peerFilters.push({ venueSubtype: current.venueSubtype.trim() });
  }

  let peers: VenueHoursPeer[] = [];
  if (peerFilters.length > 0) {
    const rows = await prisma.restaurant.findMany({
      where: {
        id: { not: current.id },
        companyId: { not: null },
        OR: peerFilters
      },
      select: {
        id: true,
        name: true,
        openingHours: true
      },
      orderBy: { name: "asc" }
    });
    const seen = new Set<string>();
    peers = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  return {
    ok: true,
    current: {
      id: current.id,
      name: current.name,
      openingHours: current.openingHours
    },
    peers
  };
}
