import { randomBytes } from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Crockford Base32 ULID — distributed-safe, sortable internal IDs for new orders. */
export function generateUlid(at = new Date()): string {
  let time = at.getTime();
  let out = "";
  for (let i = 0; i < 10; i++) {
    out = ENCODING[time % 32]! + out;
    time = Math.floor(time / 32);
  }
  const rand = randomBytes(16);
  for (let i = 0; i < 16; i++) {
    out += ENCODING[rand[i]! % 32]!;
  }
  return out;
}

export type InternalIdSchema = "cuid" | "ulid";

export const ULID_MIGRATION_POLICY = {
  strategy: "dual-schema" as const,
  defaultLegacy: "cuid" as const,
  newOrderDefault: "cuid" as const,
  optInViaPolicy: "ulid" as const,
  rule: "internalIdSchema frozen at creation — never migrate existing rows"
} as const;

export function isUlid(id: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}
