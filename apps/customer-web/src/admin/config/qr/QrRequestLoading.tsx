/** Branded request loading — same animation language as Media Library uploads. */
export function QrRequestLoading({
  title,
  sub,
  variant = "step"
}: {
  title: string;
  sub?: string;
  variant?: "step" | "final";
}) {
  return (
    <div className="media-upload-loading admin-qr-request-loading" role="status" aria-live="polite">
      <div className={variant === "final" ? "media-final-loader" : "media-step-loader"} aria-hidden />
      <p className="media-upload-loading-title media-upload-phrase" key={title}>
        {title}
      </p>
      {sub ? <p className="media-upload-loading-sub">{sub}</p> : null}
    </div>
  );
}

export function QrBusyOverlay({
  show,
  title = "Working…",
  sub
}: {
  show: boolean;
  title?: string;
  sub?: string;
}) {
  if (!show) return null;
  return (
    <div className="admin-qr-busy-overlay" aria-busy="true">
      <div className="admin-qr-busy-overlay-card">
        <QrRequestLoading title={title} sub={sub} />
      </div>
    </div>
  );
}
