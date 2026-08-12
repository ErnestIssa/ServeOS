import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SkeletonBone } from "../AdminSkeleton";
import { Spinner } from "../../components/ui/spinner";

/** Centered section spinner — same contract as payments Overview. */
export function ConfigSectionSpinner({
  label,
  sizeClassName = "size-8"
}: {
  label: string;
  sizeClassName?: string;
}) {
  return (
    <div className="admin-payments-section-loading" aria-busy aria-label={label}>
      <Spinner className={sizeClassName} />
    </div>
  );
}

/** Compact spinner for drawers / modal bodies. */
export function ConfigDrawerSpinner({ label = "Loading details" }: { label?: string }) {
  return (
    <div className="admin-payments-drawer-loading" aria-busy aria-label={label}>
      <Spinner className="size-6" />
    </div>
  );
}

/** Fade + ease content in after async payload is ready (payments Overview drawers). */
export function ConfigDetailsReveal({
  ready,
  children
}: {
  ready: boolean;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!ready) {
      setShown(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShown(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

  if (!ready) return null;

  return (
    <div className={`admin-payments-details-reveal${shown ? " is-ready" : ""}`}>{children}</div>
  );
}

/**
 * Delays children briefly so modal/drawer bodies never flash in instantly —
 * matches PaymentMethodManageDrawer / Overview detail drawers.
 */
export function ConfigModalContentGate({
  open,
  delayMs = 220,
  children,
  loadingLabel = "Loading"
}: {
  open: boolean;
  delayMs?: number;
  children: ReactNode;
  loadingLabel?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setReady(false);
    const t = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(t);
  }, [open, delayMs]);

  return (
    <>
      {!ready ? <ConfigDrawerSpinner label={loadingLabel} /> : null}
      <ConfigDetailsReveal ready={ready}>{children}</ConfigDetailsReveal>
    </>
  );
}

/** Inline button busy state — spinner instead of “Working…” / “Saving…”. */
export function ConfigBusyLabel({
  busy,
  children,
  spinnerClassName = "size-4"
}: {
  busy: boolean;
  children: ReactNode;
  spinnerClassName?: string;
}) {
  if (!busy) return <>{children}</>;
  return (
    <span className="admin-config-busy-label" aria-busy>
      <Spinner className={spinnerClassName} aria-hidden />
      <span className="sr-only">In progress</span>
    </span>
  );
}

/** Pie-shaped skeleton matching Overview health / stats pie layout. */
export function ConfigStatsPieSkeleton({ label = "Loading statistics" }: { label?: string }) {
  return (
    <div className="admin-payments-health-pie admin-config-stats-pie-skeleton" aria-busy aria-label={label}>
      <div className="admin-payments-health-pie-intro">
        <SkeletonBone className="h-8 w-36" />
        <SkeletonBone className="mt-2 h-3 w-48" rounded="sm" />
        <SkeletonBone className="mt-1 h-3 w-28" rounded="sm" />
      </div>
      <div className="admin-payments-health-metrics admin-config-stats-pie-skeleton-metrics">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="admin-config-stats-pie-skeleton-metric">
            <SkeletonBone className="h-2.5 w-14" rounded="sm" />
            <SkeletonBone className="mt-2 h-5 w-10" />
          </div>
        ))}
      </div>
      <div className="admin-payments-health-pie-chart admin-payments-health-pie-chart--skeleton">
        <span className="admin-config-stats-pie-ring" aria-hidden />
      </div>
    </div>
  );
}

// Back-compat aliases used by payments modules
export {
  ConfigSectionSpinner as PaymentsSectionSpinner,
  ConfigDrawerSpinner as PaymentsDrawerSpinner,
  ConfigDetailsReveal as PaymentsDetailsReveal
};
