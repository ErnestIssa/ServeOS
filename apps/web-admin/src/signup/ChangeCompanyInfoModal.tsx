import type { CompanyInfoDraft } from "./companyInfoDisplay";
import { useModalDraft } from "./useModalDraft";
import { SignupModalShell } from "./SignupModalShell";

type Props = {
  open: boolean;
  initial: CompanyInfoDraft;
  onClose: () => void;
  onSave: (draft: CompanyInfoDraft) => void;
};

const inputCls =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60";

const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

export function ChangeCompanyInfoModal({ open, initial, onClose, onSave }: Props) {
  const [draft, setDraft] = useModalDraft(open, initial);

  const canSave =
    draft.companyName.trim().length > 0 &&
    draft.address.trim().length > 0 &&
    draft.companyForm.trim().length > 0;

  return (
    <SignupModalShell
      open={open}
      onClose={onClose}
      labelledBy="change-company-info-title"
      panelClassName="relative z-[1] w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8"
      backdropLabel="Close company information dialog"
    >
      <h2 id="change-company-info-title" className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
        Change company information
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Update your company details if the registry information needs correction.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="change-company-name">
            Company name
          </label>
          <input
            id="change-company-name"
            type="text"
            value={draft.companyName}
            onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
            className={inputCls}
            autoFocus
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="change-company-address">
            Address
          </label>
          <input
            id="change-company-address"
            type="text"
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="change-company-form">
            Company form
          </label>
          <input
            id="change-company-form"
            type="text"
            value={draft.companyForm}
            onChange={(e) => setDraft((d) => ({ ...d, companyForm: e.target.value }))}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
          onClick={() => onSave(draft)}
          className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </SignupModalShell>
  );
}
