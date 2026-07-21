import type { PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import { processDueMenuLifecycleJobs } from "./menuReleaseService.js";

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Background release/retirement scheduler.
 * Does not depend on an admin opening the Menus page.
 */
export function startMenuReleaseScheduler(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  intervalMs = DEFAULT_INTERVAL_MS
) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processDueMenuLifecycleJobs(prisma);
      const released = result.releases.filter((r) => r.ok).length;
      const retired = result.retirements.filter((r) => r.ok).length;
      if (released > 0 || retired > 0) {
        log.info({ released, retired }, "menu_lifecycle_jobs_applied");
      }
    } catch (err) {
      log.error({ err }, "menu_lifecycle_scheduler_failed");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();

  void tick();

  return () => clearInterval(timer);
}
