import type { PrismaClient } from "@prisma/client";

let imageEnumEnsured = false;

const ADD_IMAGE_ENUM_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ChatMessageType' AND e.enumlabel = 'IMAGE'
  ) THEN
    ALTER TYPE "ChatMessageType" ADD VALUE 'IMAGE';
  END IF;
END $$;
`;

/** True when Postgres enum includes IMAGE (source of truth — not Prisma schema alone). */
export async function chatMessageImageEnumExists(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_enum e
      INNER JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'ChatMessageType' AND e.enumlabel = 'IMAGE'
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

/**
 * Neon/Postgres: `ADD VALUE` for enums cannot run inside Prisma's default migration transaction.
 * Apply at runtime (and via `prisma-migrate:disable-transaction` migrations) so IMAGE exists before chat queries.
 */
export async function ensureChatMessageImageEnum(prisma: PrismaClient): Promise<void> {
  if (imageEnumEnsured) return;
  await prisma.$executeRawUnsafe(ADD_IMAGE_ENUM_SQL);
  const ok = await chatMessageImageEnumExists(prisma);
  if (!ok) {
    imageEnumEnsured = false;
    throw new Error("ChatMessageType.IMAGE enum missing after ensure");
  }
  imageEnumEnsured = true;
}

/** Reset cached ensure state (tests / reconnect). */
export function resetChatMessageImageEnumCache(): void {
  imageEnumEnsured = false;
}

/** Count customer photo messages for quota — raw SQL so missing enum never breaks the hub. */
export async function countCustomerChatImagesInRoom(
  prisma: PrismaClient,
  chatRoomId: string
): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "ChatMessage"
      WHERE "chatRoomId" = ${chatRoomId}
        AND "senderRole" = 'CUSTOMER'
        AND "type"::text = 'IMAGE'
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    const rows = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "ChatMessage"
      WHERE "chatRoomId" = ${chatRoomId}
        AND "senderRole" = 'CUSTOMER'
        AND "content" LIKE 'data:image/%'
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
