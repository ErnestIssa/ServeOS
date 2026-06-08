import { SignupModalShell } from "./SignupModalShell";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function OwnerAccountInfoModal({ open, onClose }: Props) {
  return (
    <SignupModalShell
      open={open}
      onClose={onClose}
      labelledBy="owner-account-info-title"
      backdropLabel="Close owner account info"
    >
      <h2 id="owner-account-info-title" className="font-display text-center text-xl font-extrabold text-slate-900">
        Your Owner account
      </h2>

      <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-600">
        <p>
          This step creates your <span className="font-semibold text-slate-800">Owner account</span> — the primary
          administrator for your company on ServeOS.
        </p>
        <p>
          You&apos;ll have full access to manage venues, settings, and billing. Other people don&apos;t get access
          automatically.
        </p>
        <p>
          After setup you can invite managers and staff from your dashboard. They join through a secure invitation link,
          and you approve each person before they can use the app.
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500"
      >
        Got it
      </button>
    </SignupModalShell>
  );
}
