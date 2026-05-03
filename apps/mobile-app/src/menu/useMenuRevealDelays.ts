import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewToken } from "react-native";

/** Tighter stagger so the cascade finishes a bit sooner while each card still eases in softly */
const DEFAULT_STAGGER_MS = 54;

/** Stable fingerprint for resetting reveal state when rows change */
export function menuRowsSignature(ids: readonly { id: string }[]): string {
  return ids.map((x) => x.id).join("\0");
}

/**
 * Tracks first-time viewport reveals and assigns stagger delays (scroll-triggered sequencing).
 */
export function useMenuRevealDelays(rowsSignature: string, staggerMs: number = DEFAULT_STAGGER_MS) {
  const delayMapRef = useRef<Record<string, number>>({});
  const staggerRef = useRef(0);
  const [delayById, setDelayById] = useState<Record<string, number>>({});

  useEffect(() => {
    delayMapRef.current = {};
    staggerRef.current = 0;
    setDelayById({});
  }, [rowsSignature]);

  const onViewableItemsChanged = useCallback(
    ({ changed }: { changed: ViewToken[]; viewableItems: ViewToken[] }) => {
      let touched = false;
      for (const ch of changed) {
        if (!ch.isViewable || ch.item == null) continue;
        const row = ch.item as { id: string };
        const id = row.id;
        if (delayMapRef.current[id] !== undefined) continue;
        delayMapRef.current[id] = staggerRef.current * staggerMs;
        staggerRef.current += 1;
        touched = true;
      }
      if (touched) setDelayById({ ...delayMapRef.current });
    },
    [staggerMs]
  );

  return { delayById, onViewableItemsChanged };
}
