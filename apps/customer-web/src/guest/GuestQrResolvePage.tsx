import { useEffect, useState } from "react";
import { resolvePublicQr } from "../api";

type Props = {
  publicCode: string;
  onHome: () => void;
};

/** Resolves permanent /q/:code → temporary /menu/session/:id. */
export function GuestQrResolvePage({ publicCode, onHome }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await resolvePublicQr(publicCode);
      if (cancelled) return;
      if (!res.ok || !res.sessionId) {
        setError(res.message ?? "This QR code is unavailable. Please ask staff.");
        return;
      }
      const next = `/menu/session/${encodeURIComponent(res.sessionId)}`;
      window.history.replaceState({ view: "guest-order" }, "", next);
      window.dispatchEvent(new PopStateEvent("popstate"));
    })();
    return () => {
      cancelled = true;
    };
  }, [publicCode]);

  if (error) {
    return (
      <div className="guest-order-page min-h-screen px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-white">QR unavailable</h1>
        <p className="mt-3 text-sm text-white/70">{error}</p>
        <button type="button" className="mt-8 rounded-full border border-white/20 px-5 py-2 text-sm text-white" onClick={onHome}>
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="guest-order-page min-h-screen px-4 py-16 text-center">
      <p className="text-sm text-white/70">Opening menu…</p>
    </div>
  );
}
