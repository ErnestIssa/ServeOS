import { SignupModalShell } from "../signup/SignupModalShell";
import { SignupRegistrationLoader } from "../signup/SignupRegistrationLoader";

type Props = {
  open: boolean;
  busy: boolean;
  error?: string | null;
  ownerEmail?: string | null;
  onStay: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmModal({ open, busy, error, ownerEmail, onStay, onConfirm }: Props) {
  return (
    <SignupModalShell
      open={open}
      onClose={busy ? () => undefined : onStay}
      labelledBy={busy ? undefined : "logout-confirm-title"}
      backdropLabel="Close sign out dialog"
      panelClassName="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8"
    >
      <div className={`relative ${busy ? "min-h-[12rem]" : ""}`}>
        {busy ? (
          <SignupRegistrationLoader mode="logout" />
        ) : (
          <>
            <h2 id="logout-confirm-title" className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
              Sign out?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              {ownerEmail
                ? `You will be signed out of ${ownerEmail}. You can sign back in with the same account anytime.`
                : "You will be signed out of your ServeOS workspace. You can sign back in anytime."}
            </p>

            {error ? (
              <p className="mt-4 text-sm font-semibold text-rose-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onStay}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:border-violet-200 hover:bg-slate-50"
              >
                Stay signed in
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500"
              >
                Yes, sign out
              </button>
            </div>
          </>
        )}
      </div>
    </SignupModalShell>
  );
}
