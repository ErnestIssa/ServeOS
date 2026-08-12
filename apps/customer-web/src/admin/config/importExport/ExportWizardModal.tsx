import { useEffect, useMemo, useState } from "react";
import { exportDataTransferTarget, type ImportExportCatalog } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter, ProfileModalNote } from "../menu/menuPageModalShell";
import { useAdminToast } from "../../AdminToast";
import { ConfigDrawerSpinner } from "../configLoadingUi";
import {
  downloadTextFile,
  type ExportWizardStep,
  EXPORT_STEP_ORDER,
  wizardProgress,
  targetBlurb
} from "./transferUiHelpers";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  venueName: string;
  catalog: ImportExportCatalog | null;
  initialTarget?: string;
  onCompleted: () => void;
};

const SCOPE_OPTIONS: Record<string, Array<{ id: string; label: string; hint: string }>> = {
  menu: [
    { id: "all", label: "All menus", hint: "Every menu in this venue" },
    { id: "published", label: "Published only", hint: "Guest-visible content" },
    { id: "drafts", label: "Drafts only", hint: "Work-in-progress menus" },
    { id: "archived", label: "Archived", hint: "Retired menu content" }
  ],
  orders: [
    { id: "today", label: "Today", hint: "Orders from today" },
    { id: "week", label: "This week", hint: "Last 7 days" },
    { id: "month", label: "This month", hint: "Calendar month" },
    { id: "custom", label: "Custom range", hint: "Coming soon" }
  ],
  default: [
    { id: "all", label: "All records", hint: "Full dataset for this target" },
    { id: "active", label: "Active only", hint: "Exclude archived rows" }
  ]
};

const FORMAT_HINTS: Record<string, string> = {
  csv: "Best for spreadsheets and bulk edits.",
  xlsx: "Excel workbook with typed columns.",
  json: "Structured data for developers and integrations.",
  pdf: "Readable report for sharing offline.",
  "serveos-backup": "Full ServeOS backup package for restore/migration."
};

export function ExportWizardModal({
  open,
  onClose,
  token,
  restaurantId,
  venueName,
  catalog,
  initialTarget = "menu",
  onCompleted
}: Props) {
  const { pushToast } = useAdminToast();
  const [step, setStep] = useState<ExportWizardStep>("type");
  const [targetKey, setTargetKey] = useState(initialTarget);
  const [scope, setScope] = useState("all");
  const [format, setFormat] = useState("csv");
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includeItems, setIncludeItems] = useState(true);
  const [includeModifiers, setIncludeModifiers] = useState(true);
  const [includePrices, setIncludePrices] = useState(true);
  const [includeAvailability, setIncludeAvailability] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeDraft, setIncludeDraft] = useState(true);
  const [includeContacts, setIncludeContacts] = useState(false);
  const [destination, setDestination] = useState("download");
  const [busy, setBusy] = useState(false);
  const [exportBlob, setExportBlob] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const exportTargets = useMemo(
    () => (catalog?.targets ?? []).filter((t) => t.directions.includes("export")),
    [catalog]
  );
  const selectedTarget = exportTargets.find((t) => t.key === targetKey);
  const targetReady = selectedTarget?.availability === "available";
  const formatReady =
    Boolean(selectedTarget?.formats.includes(format)) &&
    catalog?.formats.find((f) => f.key === format)?.availability === "available";
  const scopes = SCOPE_OPTIONS[targetKey] ?? SCOPE_OPTIONS.default!;
  const progress = wizardProgress(step, EXPORT_STEP_ORDER);

  useEffect(() => {
    if (!open) return;
    setStep("type");
    setTargetKey(initialTarget || "menu");
    setScope("all");
    setFormat("csv");
    setIncludeCategories(true);
    setIncludeItems(true);
    setIncludeModifiers(true);
    setIncludePrices(true);
    setIncludeAvailability(true);
    setIncludeMedia(false);
    setIncludeArchived(false);
    setIncludeDraft(true);
    setIncludeContacts(false);
    setDestination("download");
    setExportBlob(null);
    setJobId(null);
    setBusy(false);
  }, [open, initialTarget]);

  const close = () => {
    if (busy && step === "running") return;
    onClose();
  };

  const runExport = async () => {
    if (!targetReady || !formatReady) return;
    setBusy(true);
    setStep("running");
    try {
      const res = await exportDataTransferTarget(token, restaurantId, targetKey, format);
      if (!res.ok || !res.csv) {
        setBusy(false);
        setStep("destination");
        pushToast(res.message ?? "Export failed", "error");
        return;
      }
      setExportBlob(res.csv);
      setJobId(res.jobId ?? null);
      setBusy(false);
      setStep("done");
      pushToast("Export ready.", "success");
      onCompleted();
    } catch {
      setBusy(false);
      setStep("destination");
      pushToast("Export failed. Try again.", "error");
    }
  };

  const downloadReady = () => {
    if (!exportBlob) return;
    downloadTextFile(
      `${targetKey}-${restaurantId}.${format === "csv" ? "csv" : format}`,
      exportBlob,
      format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8"
    );
  };

  const titles: Record<ExportWizardStep, { title: string; description: string }> = {
    type: {
      title: "What would you like to export?",
      description: "Choose a dataset. Sensitive exports respect your role permissions."
    },
    scope: {
      title: "Choose scope",
      description: `Limit what leaves ${venueName || "this venue"}.`
    },
    format: {
      title: "Export format",
      description: "Pick the format that matches how you’ll use the data."
    },
    options: {
      title: "Export options",
      description: "Include only the fields you need."
    },
    destination: {
      title: "Destination",
      description: "Download now. Cloud and scheduled delivery are coming soon."
    },
    running: {
      title: "Preparing export…",
      description: "Building your file in the background."
    },
    done: {
      title: "Export ready",
      description: "Download is temporary and authorized for this session."
    }
  };

  const meta = titles[step];

  return (
    <MenuPageModalShell
      open={open}
      onClose={close}
      title={meta.title}
      description={meta.description}
      titleId="data-transfer-export-wizard"
      maxWidthClass="max-w-2xl"
      maxHeightClass="max-h-[min(94dvh,48rem)]"
      busy={busy && step === "running"}
      panelClassName="data-transfer-wizard-modal"
    >
      <div className="data-transfer-wizard-progress" aria-hidden>
        <div className="data-transfer-wizard-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {step === "type" ? (
        <div className="data-transfer-type-grid">
          {exportTargets.map((t) => {
            const planned = t.availability !== "available";
            return (
              <button
                key={t.key}
                type="button"
                className={`data-transfer-type-card ${targetKey === t.key ? "is-selected" : ""} ${planned ? "is-planned" : ""}`}
                onClick={() => {
                  setTargetKey(t.key);
                  setFormat(t.formats[0] ?? "csv");
                  setScope((SCOPE_OPTIONS[t.key] ?? SCOPE_OPTIONS.default!)[0]!.id);
                }}
              >
                <span className="data-transfer-type-card-title">{t.label}</span>
                <span className="data-transfer-type-card-desc">{targetBlurb(t.key, t.description)}</span>
                {planned ? <span className="data-transfer-soon">Soon</span> : null}
              </button>
            );
          })}
          <ProfileModalFooter
            cancelLabel="Cancel"
            onCancel={close}
            confirmLabel="Continue"
            onConfirm={() => {
              if (!targetReady) {
                pushToast(`${selectedTarget?.label ?? "This"} export is coming soon.`, "error");
                return;
              }
              setStep("scope");
            }}
          />
        </div>
      ) : null}

      {step === "scope" ? (
        <div className="space-y-4">
          <div className="data-transfer-choice-stack">
            {scopes.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={s.id === "custom"}
                className={`data-transfer-choice ${scope === s.id ? "is-selected" : ""}`}
                onClick={() => setScope(s.id)}
              >
                <span className="data-transfer-choice-title">{s.label}</span>
                <span className="data-transfer-choice-desc">{s.hint}</span>
              </button>
            ))}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("type")}
            confirmLabel="Continue"
            onConfirm={() => setStep("format")}
          />
        </div>
      ) : null}

      {step === "format" ? (
        <div className="space-y-4">
          <div className="data-transfer-choice-stack">
            {(catalog?.formats ?? []).map((f) => {
              const allowed = selectedTarget?.formats.includes(f.key);
              const available = f.availability === "available" && allowed;
              return (
                <button
                  key={f.key}
                  type="button"
                  disabled={!available}
                  className={`data-transfer-choice ${format === f.key ? "is-selected" : ""}`}
                  onClick={() => setFormat(f.key)}
                >
                  <span className="data-transfer-choice-title">
                    {f.label}
                    {!available ? " · soon" : ""}
                  </span>
                  <span className="data-transfer-choice-desc">{FORMAT_HINTS[f.key] ?? f.label}</span>
                </button>
              );
            })}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("scope")}
            confirmLabel="Continue"
            confirmDisabled={!formatReady}
            onConfirm={() => setStep("options")}
          />
        </div>
      ) : null}

      {step === "options" ? (
        <div className="space-y-4">
          {targetKey === "menu" || targetKey === "categories" || targetKey === "items" ? (
            <div className="data-transfer-check-grid">
              {[
                { id: "cat", label: "Categories", value: includeCategories, set: setIncludeCategories },
                { id: "items", label: "Items", value: includeItems, set: setIncludeItems },
                { id: "mods", label: "Modifiers", value: includeModifiers, set: setIncludeModifiers },
                { id: "prices", label: "Prices", value: includePrices, set: setIncludePrices },
                { id: "avail", label: "Availability", value: includeAvailability, set: setIncludeAvailability },
                { id: "media", label: "Media references", value: includeMedia, set: setIncludeMedia },
                { id: "arch", label: "Archived items", value: includeArchived, set: setIncludeArchived },
                { id: "draft", label: "Draft content", value: includeDraft, set: setIncludeDraft }
              ].map((opt) => (
                <label key={opt.id} className="data-transfer-check">
                  <input
                    type="checkbox"
                    checked={opt.value}
                    onChange={(e) => opt.set(e.target.checked)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="data-transfer-check-grid">
              <label className="data-transfer-check">
                <input
                  type="checkbox"
                  checked={includeContacts}
                  onChange={(e) => setIncludeContacts(e.target.checked)}
                />
                <span>Customer contact information</span>
              </label>
              <label className="data-transfer-check is-disabled">
                <input type="checkbox" disabled />
                <span>Payment-related information · permission required</span>
              </label>
            </div>
          )}
          {includeContacts ? (
            <ProfileModalNote>
              This export may contain customer information. Your permission allows access to this data.
            </ProfileModalNote>
          ) : null}
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("format")}
            confirmLabel="Continue"
            onConfirm={() => setStep("destination")}
          />
        </div>
      ) : null}

      {step === "destination" ? (
        <div className="space-y-4">
          <div className="data-transfer-choice-stack">
            {[
              { id: "download", label: "Download", hint: "Prepare a file for this browser session.", soon: false },
              { id: "email", label: "Email", hint: "Send when ready.", soon: true },
              { id: "drive", label: "Google Drive", hint: "Copy into Drive.", soon: true },
              { id: "dropbox", label: "Dropbox", hint: "Copy into Dropbox.", soon: true },
              { id: "webhook", label: "Webhook", hint: "POST to your endpoint.", soon: true }
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={d.soon}
                className={`data-transfer-choice ${destination === d.id ? "is-selected" : ""}`}
                onClick={() => setDestination(d.id)}
              >
                <span className="data-transfer-choice-title">
                  {d.label}
                  {d.soon ? " · soon" : ""}
                </span>
                <span className="data-transfer-choice-desc">{d.hint}</span>
              </button>
            ))}
          </div>
          <ProfileModalNote>
            Large exports are prepared in the background. Download links expire for security.
          </ProfileModalNote>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("options")}
            confirmLabel="Create export"
            confirmDisabled={!formatReady || destination !== "download"}
            onConfirm={() => void runExport()}
          />
        </div>
      ) : null}

      {step === "running" ? (
        <ConfigDrawerSpinner label={`Preparing ${selectedTarget?.label ?? "export"}`} />
      ) : null}

      {step === "done" ? (
        <div className="space-y-4">
          <div className="data-transfer-done-hero">
            <div className="media-final-loader mx-auto" aria-hidden />
            <p className="data-transfer-done-title">Export ready</p>
            <p className="data-transfer-done-sub">
              {selectedTarget?.label ?? "Data"} · {format.toUpperCase()} · expires in 24 hours
            </p>
            {jobId ? <p className="data-transfer-done-meta">Job {jobId.slice(0, 8)}…</p> : null}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              onClick={() => {
                setExportBlob(null);
                setStep("type");
              }}
            >
              Create another
            </button>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--primary"
              onClick={downloadReady}
            >
              Download
            </button>
          </div>
          <button type="button" className="data-transfer-link-btn" onClick={close}>
            Close
          </button>
        </div>
      ) : null}
    </MenuPageModalShell>
  );
}
