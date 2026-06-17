import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";

const SALT_ROUNDS = 10;

export async function verifyUserPassword(
  prisma: PrismaClient,
  user: { id: string; password: string },
  password: string
): Promise<boolean> {
  if (user.password.startsWith("$2")) {
    return bcrypt.compare(password, user.password);
  }
  if (user.password !== password) return false;
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(password, SALT_ROUNDS) }
  });
  return true;
}
