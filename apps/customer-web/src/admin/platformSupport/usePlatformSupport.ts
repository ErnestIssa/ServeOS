import { useCallback, useEffect, useRef, useState } from "react";
import { readStoredAdminToken } from "../../authStorage";
import {
  closePlatformSupportSession,
  fetchPlatformSupportState,
  openPlatformSupportSession,
  postPlatformSupportActivity,
  postPlatformSupportInteraction,
  type PlatformSupportState
} from "./platformSupportApi";
import { PLATFORM_SUPPORT_OPEN_EVENT, type PlatformSupportOpenDetail } from "./platformSupportEvents";

const PLATFORM_ACTIVITY_THROTTLE_MS = 20_000;
const STATE_POLL_MS = 45_000;

export function usePlatformSupport(enabled: boolean) {
  const [state, setState] = useState<PlatformSupportState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const lastPlatformPing = useRef(0);
  const token = readStoredAdminToken();

  const syncFromServer = useCallback(async () => {
    if (!enabled || !token) return null;
    const res = await fetchPlatformSupportState(token);
    if (!res.ok) return null;
    setState(res);
    setModalOpen(res.modalOpen);
    return res;
  }, [enabled, token]);

  const recordPlatformActivity = useCallback(async () => {
    if (!enabled || !token) return;
    const now = Date.now();
    if (now - lastPlatformPing.current < PLATFORM_ACTIVITY_THROTTLE_MS) return;
    lastPlatformPing.current = now;
    const res = await postPlatformSupportActivity(token);
    if (res.ok) setState(res);
  }, [enabled, token]);

  const openSupport = useCallback(
    async (source: PlatformSupportOpenDetail["source"]) => {
      if (!enabled || !token) {
        setModalOpen(true);
        return;
      }
      const res = await openPlatformSupportSession(token, source);
      if (res.ok) {
        setState(res);
        setModalOpen(true);
      } else {
        setModalOpen(true);
      }
    },
    [enabled, token]
  );

  const closeSupport = useCallback(async () => {
    setModalOpen(false);
    if (!enabled || !token) return;
    const res = await closePlatformSupportSession(token);
    if (res.ok) setState(res);
  }, [enabled, token]);

  const recordSupportInteraction = useCallback(
    async (hasActiveThread: boolean) => {
      if (!enabled || !token) return;
      const res = await postPlatformSupportInteraction(token, hasActiveThread);
      if (res.ok) {
        setState(res);
        if (!res.modalOpen) setModalOpen(false);
      }
    },
    [enabled, token]
  );

  useEffect(() => {
    if (!enabled || !token) return;
    void syncFromServer();
    void recordPlatformActivity();
  }, [enabled, syncFromServer, recordPlatformActivity, token]);

  useEffect(() => {
    if (!enabled || !modalOpen || !state?.policy || state.hasActiveThread) return;
    let timer = window.setTimeout(() => {
      void closeSupport();
    }, state.policy.modalIdleCloseMs);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void closeSupport();
      }, state.policy.modalIdleCloseMs);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [closeSupport, enabled, modalOpen, state?.hasActiveThread, state?.policy]);

  useEffect(() => {
    if (!enabled) return;

    const onPlatformActivity = () => void recordPlatformActivity();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    for (const ev of events) {
      window.addEventListener(ev, onPlatformActivity, { passive: true });
    }

    const poll = window.setInterval(() => {
      void syncFromServer();
    }, modalOpen ? 30_000 : STATE_POLL_MS);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, onPlatformActivity);
      }
      window.clearInterval(poll);
    };
  }, [enabled, modalOpen, recordPlatformActivity, syncFromServer]);

  useEffect(() => {
    if (!enabled) return;

    const onOpenRequest = (ev: Event) => {
      const detail = (ev as CustomEvent<PlatformSupportOpenDetail>).detail;
      void openSupport(detail?.source ?? "PLATFORM_HELP");
    };

    window.addEventListener(PLATFORM_SUPPORT_OPEN_EVENT, onOpenRequest);
    return () => window.removeEventListener(PLATFORM_SUPPORT_OPEN_EVENT, onOpenRequest);
  }, [enabled, openSupport]);

  useEffect(() => {
    if (!enabled || !state) return;
    if (!state.modalOpen && modalOpen) {
      setModalOpen(false);
    }
  }, [enabled, modalOpen, state]);

  const onFabOpen = useCallback(() => {
    void openSupport("FAB");
  }, [openSupport]);

  return {
    fabVisible: enabled ? (state?.fabVisible ?? true) : true,
    isVisible: modalOpen,
    policy: state?.policy ?? null,
    onFabOpen,
    onClose: closeSupport,
    onSupportInteraction: recordSupportInteraction
  };
}
