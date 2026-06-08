import { SignupModalShell } from "./SignupModalShell";

type Props = {
  open: boolean;
  onStay: () => void;
  onConfirm: () => void;
};

export function SignupCancelModal({ open, onStay, onConfirm }: Props) {
  return (
    <SignupModalShell open={open} onClose={onStay} labelledBy="signup-cancel-title" backdropLabel="Close cancel dialog">
      <h2 id="signup-cancel-title" className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
        Cancel setup?
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        Are you sure you want to cancel? Any changes you&apos;ve made so far won&apos;t be saved.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onStay}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:border-violet-200 hover:bg-slate-50"
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500"
        >
          Yes, cancel
        </button>
      </div>
    </SignupModalShell>
  );
}
