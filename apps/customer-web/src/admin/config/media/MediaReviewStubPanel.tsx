export function MediaReviewStubPanel() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6 dark:border-slate-700/50 dark:bg-slate-900/30">
      <h3 className="font-display text-lg font-bold admin-config-text">Review queue</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed admin-config-text-muted">
        Manager approval for uploads — like waiting for review, rejected, or needs a crop — is coming
        in a later update. This panel stays empty until that review flow is ready.
      </p>
    </div>
  );
}
