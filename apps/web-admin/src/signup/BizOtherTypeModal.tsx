import { useModalDraft } from "./useModalDraft";
import { SignupModalShell } from "./SignupModalShell";

type Props = {
  open: boolean;
  initialValue?: string;
  onClose: () => void;
  onSave: (value: string) => void;
};

export function BizOtherTypeModal({ open, initialValue = "", onClose, onSave }: Props) {
  const [draft, setDraft] = useModalDraft(open, initialValue);
  const canSave = draft.trim().length > 0;

  return (
    <SignupModalShell
      open={open}
      onClose={onClose}
      labelledBy="biz-other-type-title"
      panelClassName="relative z-[1] w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8"
      backdropLabel="Close business type dialog"
    >
      <h2 id="biz-other-type-title" className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
        Other business type
      </h2>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Please describe the business you intend to use ServeOS for in full details"
        rows={5}
        autoFocus
        className="mt-4 w-full resize-y rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60"
      />

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:border-violet-200 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(draft.trim())}
          className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </SignupModalShell>
  );
}
