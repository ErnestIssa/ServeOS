import type { PrismaClient } from "@prisma/client";

export async function getAppPreferences(prisma: PrismaClient, userId: string) {
  const row = await prisma.userAppPreferences.findUnique({ where: { userId } });
  return (
    row ?? {
      language: "en",
      timezone: "Europe/Stockholm",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      theme: "system"
    }
  );
}

export async function patchAppPreferences(
  prisma: PrismaClient,
  userId: string,
  body: {
    language?: string;
    timezone?: string;
    dateFormat?: string;
    timeFormat?: string;
    theme?: string;
  }
) {
  return prisma.userAppPreferences.upsert({
    where: { userId },
    create: {
      userId,
      language: body.language ?? "en",
      timezone: body.timezone ?? "Europe/Stockholm",
      dateFormat: body.dateFormat ?? "YYYY-MM-DD",
      timeFormat: body.timeFormat ?? "24h",
      theme: body.theme ?? "system"
    },
    update: {
      ...(body.language !== undefined ? { language: body.language } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.dateFormat !== undefined ? { dateFormat: body.dateFormat } : {}),
      ...(body.timeFormat !== undefined ? { timeFormat: body.timeFormat } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {})
    }
  });
}
