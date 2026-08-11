import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Spinner } from "../../../components/ui/spinner";

export function PaymentsSectionSpinner({
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

export function PaymentsDrawerSpinner({ label = "Loading details" }: { label?: string }) {
  return (
    <div className="admin-payments-drawer-loading" aria-busy aria-label={label}>
      <Spinner className="size-6" />
    </div>
  );
}

/** Fade + ease content in after async drawer payload is ready. */
export function PaymentsDetailsReveal({
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
