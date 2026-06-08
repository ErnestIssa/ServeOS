import { SignupModalShell } from "./SignupModalShell";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SignupConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Keep going",
  onCancel,
  onConfirm
}: Props) {
  return (
    <SignupModalShell
      open={open}
      onClose={onCancel}
      labelledBy="signup-confirm-title"
      backdropLabel="Close confirmation dialog"
    >
      <h2 id="signup-confirm-title" className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{message}</p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:border-violet-200 hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500"
        >
          {confirmLabel}
        </button>
      </div>
    </SignupModalShell>
  );
}
