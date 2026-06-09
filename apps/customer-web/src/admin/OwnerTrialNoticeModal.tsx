import { SignupModalShell } from "../signup/SignupModalShell";
import type { TrialNoticePayload } from "./deploymentApi";

type Props = {
  open: boolean;
  notice: TrialNoticePayload | null;
  dismissing?: boolean;
  onDismiss: () => void;
};

function formatTrialEnd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function OwnerTrialNoticeModal({ open, notice, dismissing, onDismiss }: Props) {
  if (!notice) return null;

  const isWelcome = notice.kind === "welcome";

  return (
    <SignupModalShell
      open={open}
      onClose={onDismiss}
      labelledBy="owner-trial-notice-title"
      backdropLabel="Close trial notice"
      panelClassName="relative z-[1] w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700/90">
        {isWelcome ? "Trial started" : "Trial reminder"}
      </p>
      <h2 id="owner-trial-notice-title" className="font-display mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
        {notice.title}
      </h2>

      <div className="mt-4 rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-white to-blue-50/80 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-800">{notice.companyName}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{notice.planName} plan</p>
        <p className="mt-1 text-xs text-slate-600">
          Trial ends {formatTrialEnd(notice.trialEndsAt)}
          {notice.daysRemaining > 0 ? ` · ${notice.daysRemaining} day${notice.daysRemaining === 1 ? "" : "s"} left` : ""}
        </p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">{notice.message}</p>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">In this workspace</p>
        <ul className="mt-2 space-y-2">
          {notice.helpPointers.map((pointer) => (
            <li key={pointer.anchor}>
              <a
                href={pointer.anchor}
                className="text-sm font-semibold text-violet-700 underline-offset-2 transition hover:text-violet-900 hover:underline"
              >
                {pointer.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Need help? Use the support chat on the marketing site or email hello@serveos.com — your owner account can
          invite managers and staff when you&apos;re ready.
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {dismissing ? "Saving…" : notice.dismissLabel}
        </button>
      </div>
    </SignupModalShell>
  );
}
