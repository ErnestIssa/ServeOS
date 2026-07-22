import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ServeOS admin data sync — recovery + silent freshness.
 *
 * Philosophy:
 * - The UI should stay correct without asking users to refresh.
 * - Manual refresh is a rare recovery tool (reconnect / invalidate / refetch).
 * - Day-to-day updates: realtime where available, silent revalidation elsewhere.
 *
 * Layers:
 * - L2: silent background / focus revalidation
 * - L4: window focus + visibility sync
 * - L5: page-level recovery sync (manual ↻)
 *
 * L1 (WebSocket), L3 (targeted invalidation), offline queue, and versioned
 * differential sync build on these hooks without changing page UX.
 */

export type SyncTask = () => void | Promise<void>;

export type SilentRevalidateOptions = {
  /** Minimum ms between silent syncs (focus thrash guard). Default 15s. */
  minIntervalMs?: number;
  /** Optional interval while the tab is visible. 0 / omit = no polling. */
  intervalMs?: number;
  enabled?: boolean;
};

/**
 * Silently re-fetch when the tab becomes visible / window focuses,
 * and optionally on a quiet interval. No spinner — callers should prefer
 * soft reload modes that do not blank the page.
 */
export function useSilentRevalidate(sync: SyncTask, options: SilentRevalidateOptions = {}) {
  const { minIntervalMs = 15_000, intervalMs = 0, enabled = true } = options;
  const syncRef = useRef(sync);
  const lastAtRef = useRef(0);
  syncRef.current = sync;

  const runSilent = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const now = Date.now();
      if (!force && now - lastAtRef.current < minIntervalMs) return;
      lastAtRef.current = now;
      try {
        await syncRef.current();
      } catch {
        /* Silent — recovery refresh is the user-facing fallback. */
      }
    },
    [enabled, minIntervalMs]
  );

  useEffect(() => {
    if (!enabled) return;

    const onFocusOrVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void runSilent(false);
    };

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    let timer: number | null = null;
    if (intervalMs > 0) {
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") void runSilent(false);
      }, intervalMs);
    }

    return () => {
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      if (timer != null) window.clearInterval(timer);
    };
  }, [enabled, intervalMs, runSilent]);

  return { runSilent };
}

/** Page-header recovery: run all sync tasks for this workspace page. */
export async function runPageRecoverySync(tasks: SyncTask[]) {
  const results = await Promise.allSettled(tasks.map((t) => Promise.resolve(t())));
  const failed = results.filter((r) => r.status === "rejected").length;
  return { ok: failed === 0, failed };
}

export function usePageRecoverySync(tasks: SyncTask[]) {
  const [recovering, setRecovering] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const recover = useCallback(async () => {
    setRecovering(true);
    try {
      return await runPageRecoverySync(tasksRef.current);
    } finally {
      setRecovering(false);
    }
  }, []);

  return { recover, recovering };
}
