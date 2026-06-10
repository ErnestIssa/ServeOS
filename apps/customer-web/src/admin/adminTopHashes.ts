export const ADMIN_TOP_HASHES = {
  billing: "#top-billing",
  notifications: "#top-notifications",
  addStaff: "#top-add-staff",
  platformHelp: "#top-platform-help",
  profile: "#top-profile"
} as const;

export const ADMIN_VENUE_CONTROL_HASH = "#venue-control-centre";

export type AdminTopHash = (typeof ADMIN_TOP_HASHES)[keyof typeof ADMIN_TOP_HASHES];

const TOP_HASH_SET = new Set<string>(Object.values(ADMIN_TOP_HASHES));

export function isAdminTopPageHash(hash: string): hash is AdminTopHash {
  return TOP_HASH_SET.has(hash);
}

export function isAdminFullPageHash(hash: string): boolean {
  return isAdminTopPageHash(hash) || hash === ADMIN_VENUE_CONTROL_HASH;
}

export function adminFullPageKey(hash: string): string {
  if (isAdminFullPageHash(hash)) return hash;
  const match = (hash || "").match(/^#ws-[a-z-]+\/[^/]+$/);
  if (match) return hash;
  return "#ws-live-ops/live-overview";
}
