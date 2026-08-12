import { useEffect, useMemo, useRef, useState } from "react";
import {
  previewDataTransferImport,
  runDataTransferImport,
  type ImportExportCatalog,
  type MenuCsvPreview
} from "../../../api";
import { MenuPageModalShell, ProfileModalFooter, ProfileModalNote } from "../menu/menuPageModalShell";
import { useAdminToast } from "../../AdminToast";
import { ConfigDrawerSpinner } from "../configLoadingUi";
import {
  MENU_CSV_TEMPLATE,
  MENU_FIELD_MAP,
  downloadTextFile,
  formatBytes,
  formatLimitBytes,
  previewCreateEstimate,
  type ImportWizardStep,
  wizardProgress,
  IMPORT_STEP_ORDER,
  targetBlurb
} from "./transferUiHelpers";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  venueName: string;
  catalog: ImportExportCatalog | null;
  canEdit: boolean;
  initialTarget?: string;
  onCompleted: () => void;
};

const ANALYZE_PHRASES = [
  "Uploading file…",
  "Scanning headers…",
  "Detecting entity type…",
  "Checking relationships…",
  "Validating rows…"
];

export function ImportWizardModal({
  open,
  onClose,
  token,
  restaurantId,
  venueName,
  catalog,
  canEdit,
  initialTarget = "menu",
  onCompleted
}: Props) {
  const { pushToast } = useAdminToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportWizardStep>("type");
  const [targetKey, setTargetKey] = useState(initialTarget);
  const [sourceKey, setSourceKey] = useState("csv");
  const [conflictStrategy, setConflictStrategy] = useState("skip");
  const [matchBy, setMatchBy] = useState("name_category");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzePhrase, setAnalyzePhrase] = useState(ANALYZE_PHRASES[0]!);
  const [preview, setPreview] = useState<MenuCsvPreview | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [resultJobId, setResultJobId] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  const importTargets = useMemo(
    () => (catalog?.targets ?? []).filter((t) => t.directions.includes("import")),
    [catalog]
  );
  const selectedTarget = importTargets.find((t) => t.key === targetKey);
  const selectedSource = catalog?.sources.find((s) => s.key === sourceKey);
  const targetReady = selectedTarget?.availability === "available";
  const sourceReady = selectedSource?.availability === "available";
  const limits = catalog?.limits;
  const createEst = previewCreateEstimate(preview);
  const progress = wizardProgress(step, IMPORT_STEP_ORDER);

  useEffect(() => {
    if (!open) return;
    setStep("type");
    setTargetKey(initialTarget || "menu");
    setSourceKey("csv");
    setConflictStrategy("skip");
    setMatchBy("name_category");
    setFile(null);
    setPreview(null);
    setFileHash(null);
    setIgnoredColumns([]);
    setResultSummary(null);
    setResultJobId(null);
    setExpandedIssue(null);
    setBusy(false);
  }, [open, initialTarget]);

  useEffect(() => {
    if (step !== "analyzing") return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % ANALYZE_PHRASES.length;
      setAnalyzePhrase(ANALYZE_PHRASES[i]!);
    }, 900);
    return () => window.clearInterval(id);
  }, [step]);

  const close = () => {
    if (busy && (step === "analyzing" || step === "running")) return;
    onClose();
  };

  const acceptFile = (next: File | null) => {
    if (!next) return;
    const max = limits?.maxCsvBytes ?? 5 * 1024 * 1024;
    if (next.size > max) {
      pushToast(`File exceeds ${formatLimitBytes(max)} limit.`, "error");
      return;
    }
    setFile(next);
    setPreview(null);
    setFileHash(null);
  };

  const runAnalyze = async () => {
    if (!file || !targetReady || !sourceReady) return;
    setBusy(true);
    setStep("analyzing");
    setAnalyzePhrase(ANALYZE_PHRASES[0]!);
    try {
      const csv = await file.text();
      const res = await previewDataTransferImport(token, restaurantId, targetKey, {
        csv,
        sourceFormat: sourceKey,
        fileName: file.name
      });
      if (!res.ok || !res.preview) {
        setBusy(false);
        setStep("upload");
        pushToast(res.message ?? res.error ?? "Could not analyze file", "error");
        return;
      }
      setPreview(res.preview);
      setFileHash(res.fileHash ?? null);
      setBusy(false);
      setStep("analysis");
    } catch {
      setBusy(false);
      setStep("upload");
      pushToast("Analysis failed. Try again.", "error");
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!file || !canEdit || !targetReady) return;
    setBusy(true);
    setStep("running");
    try {
      const csv = await file.text();
      const res = await runDataTransferImport(token, restaurantId, targetKey, {
        csv,
        sourceFormat: sourceKey,
        fileName: file.name,
        dryRun,
        conflictStrategy: conflictStrategy as "skip"
      });
      if (!res.ok) {
        setBusy(false);
        setStep("confirm");
        setPreview(res.preview ?? preview);
        pushToast(res.message ?? res.error ?? (dryRun ? "Validation failed" : "Import failed"), "error");
        return;
      }
      if (res.preview) setPreview(res.preview);
      const s = res.summary;
      setResultSummary(
        dryRun
          ? "No changes were made to your venue. Validation completed successfully."
          : s
            ? `${s.rows.toLocaleString()} records processed · ${s.imported ?? 0} imported · ${s.warnings ?? 0} warnings · ${s.skipped ?? 0} skipped · ${s.failed ?? 0} failed`
            : `Imported ${res.imported?.rows ?? 0} rows into draft data.`
      );
      setResultJobId(res.jobId ?? null);
      setBusy(false);
      setStep("done");
      pushToast(dryRun ? "Dry run complete — nothing written." : "Import completed.", "success");
      onCompleted();
    } catch {
      setBusy(false);
      setStep("confirm");
      pushToast("Import failed. Try again.", "error");
    }
  };

  const errors = preview?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = preview?.issues.filter((i) => i.severity === "warning") ?? [];
  const canProceedPastValidation = (preview?.errorCount ?? 0) === 0;

  const stepMeta: Record<ImportWizardStep, { title: string; description: string }> = {
    type: {
      title: "What are you importing?",
      description: "Choose the data type. Available targets can run now; others appear as coming soon."
    },
    source: {
      title: "Choose a source",
      description: "Upload a file or connect a service. Templates keep formatting consistent."
    },
    upload: {
      title: "Upload your file",
      description: "Drag and drop or browse. ServeOS validates on the server before anything is written."
    },
    analyzing: {
      title: "Analyzing file",
      description: "Inspecting structure, headers, and row health."
    },
    analysis: {
      title: "File analyzed",
      description: "Review automatic detection before mapping columns."
    },
    mapping: {
      title: "Column mapping",
      description: "Confirm how source columns map to ServeOS fields."
    },
    validation: {
      title: "Validation report",
      description: "Errors block import. Warnings can be reviewed and continued."
    },
    conflict: {
      title: "Conflict strategy",
      description: "Decide what happens when records already exist in this venue."
    },
    preview: {
      title: "Preview changes",
      description: "See what will be created, skipped, and left untouched."
    },
    confirm: {
      title: "Confirm import",
      description: "Imports produce draft changes. Published guest-facing data stays unchanged until you publish."
    },
    running: {
      title: "Importing…",
      description: "This operation continues server-side. You can leave after it finishes."
    },
    done: {
      title: "Import complete",
      description: "Review results, download a report later from History, or start another transfer."
    }
  };

  const meta = stepMeta[step];

  return (
    <MenuPageModalShell
      open={open}
      onClose={close}
      title={meta.title}
      description={meta.description}
      titleId="data-transfer-import-wizard"
      maxWidthClass="max-w-2xl"
      maxHeightClass="max-h-[min(94dvh,48rem)]"
      busy={busy && (step === "analyzing" || step === "running")}
      panelClassName="data-transfer-wizard-modal"
    >
      <div className="data-transfer-wizard-progress" aria-hidden>
        <div className="data-transfer-wizard-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {step === "type" ? (
        <div className="data-transfer-type-grid">
          {importTargets.map((t) => {
            const planned = t.availability !== "available";
            return (
              <button
                key={t.key}
                type="button"
                className={`data-transfer-type-card ${targetKey === t.key ? "is-selected" : ""} ${planned ? "is-planned" : ""}`}
                onClick={() => setTargetKey(t.key)}
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
            confirmDisabled={!selectedTarget}
            onConfirm={() => {
              if (!targetReady) {
                pushToast(`${selectedTarget?.label ?? "This target"} import is coming soon.`, "error");
                return;
              }
              setStep("source");
            }}
          />
        </div>
      ) : null}

      {step === "source" ? (
        <div className="space-y-4">
          <div className="data-transfer-source-block">
            <p className="data-transfer-block-label">Upload a file</p>
            <div className="data-transfer-source-grid">
              {(catalog?.sources ?? [])
                .filter((s) => s.key === "csv" || s.key === "xlsx" || s.key === "json")
                .map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    disabled={s.availability !== "available"}
                    className={`data-transfer-source-pill ${sourceKey === s.key ? "is-selected" : ""}`}
                    onClick={() => setSourceKey(s.key)}
                  >
                    {s.label}
                    {s.availability !== "available" ? " · soon" : ""}
                  </button>
                ))}
            </div>
          </div>
          <div className="data-transfer-source-block">
            <p className="data-transfer-block-label">Connect a service</p>
            <div className="data-transfer-source-grid">
              {(catalog?.migrationProviders ?? [])
                .filter((p) => p.key !== "custom-csv" && p.key !== "excel")
                .slice(0, 5)
                .map((p) => (
                  <button key={p.key} type="button" disabled className="data-transfer-source-pill is-planned">
                    {p.label} · soon
                  </button>
                ))}
            </div>
          </div>
          <div className="data-transfer-template-callout">
            <div>
              <p className="data-transfer-template-title">Download template</p>
              <p className="data-transfer-template-desc">
                Not sure how to format your file? Use the ServeOS {selectedTarget?.label ?? "data"} template.
              </p>
            </div>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              onClick={() =>
                downloadTextFile(
                  `serveos-${targetKey}-template.csv`,
                  MENU_CSV_TEMPLATE,
                  "text/csv;charset=utf-8"
                )
              }
            >
              Download
            </button>
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("type")}
            confirmLabel="Continue"
            confirmDisabled={!sourceReady}
            onConfirm={() => setStep("upload")}
          />
        </div>
      ) : null}

      {step === "upload" ? (
        <div className="space-y-4">
          <div
            className={`media-upload-drop data-transfer-drop ${dragOver ? "media-upload-drop--active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
          >
            <p className="data-transfer-drop-title">Drop your file here</p>
            <p className="data-transfer-drop-sub">or browse from this device</p>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--primary mt-3"
              onClick={() => inputRef.current?.click()}
            >
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                acceptFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
          <ul className="data-transfer-req-list">
            <li>Accepted: CSV{catalog?.formats.some((f) => f.key === "xlsx" && f.availability === "available") ? ", XLSX" : " (Excel soon)"}</li>
            <li>Maximum size: {formatLimitBytes(limits?.maxCsvBytes ?? 5 * 1024 * 1024)}</li>
            <li>Maximum rows: {(limits?.maxCsvRows ?? 20000).toLocaleString()}</li>
          </ul>
          {file ? (
            <div className="data-transfer-file-chip">
              <div>
                <p className="data-transfer-file-name">{file.name}</p>
                <p className="data-transfer-file-meta">{formatBytes(file.size)} · ready to analyze</p>
              </div>
              <button type="button" className="data-transfer-link-btn" onClick={() => setFile(null)}>
                Remove
              </button>
            </div>
          ) : null}
          <ProfileModalNote>
            Draft changes only — published menus and guest-facing data will not change until you publish.
          </ProfileModalNote>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("source")}
            confirmLabel="Analyze file"
            confirmDisabled={!file}
            onConfirm={() => void runAnalyze()}
          />
        </div>
      ) : null}

      {step === "analyzing" ? (
        <div className="space-y-2" aria-busy>
          <ConfigDrawerSpinner label={analyzePhrase} />
          {file ? <p className="text-center text-xs admin-config-text-muted">{file.name}</p> : null}
        </div>
      ) : null}

      {step === "analysis" && preview ? (
        <div className="space-y-4">
          <div className="data-transfer-analysis-hero">
            <p className="data-transfer-analysis-kicker">File analyzed</p>
            <p className="data-transfer-analysis-value">{preview.rowCount.toLocaleString()} rows detected</p>
          </div>
          <div className="data-transfer-stat-row">
            <div className="data-transfer-mini-stat is-success">
              <span>✓ {preview.validRows.toLocaleString()}</span>
              <span>valid</span>
            </div>
            <div className="data-transfer-mini-stat is-warning">
              <span>⚠ {preview.warningCount.toLocaleString()}</span>
              <span>warnings</span>
            </div>
            <div className="data-transfer-mini-stat is-danger">
              <span>✕ {preview.errorCount.toLocaleString()}</span>
              <span>errors</span>
            </div>
          </div>
          <div className="data-transfer-detect-list">
            <p>Detected: ServeOS menu CSV headers</p>
            <p>Entity type: {selectedTarget?.label ?? "Menu"}</p>
            <p>Price format: integer cents</p>
            {fileHash ? <p className="truncate">SHA-256: {fileHash.slice(0, 16)}…</p> : null}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("upload")}
            confirmLabel="Review mapping"
            onConfirm={() => setStep("mapping")}
          />
        </div>
      ) : null}

      {step === "mapping" ? (
        <div className="space-y-4">
          <div className="data-transfer-map-table">
            <div className="data-transfer-map-head">
              <span>Source column</span>
              <span>ServeOS field</span>
            </div>
            {MENU_FIELD_MAP.map((row) => {
              const ignored = ignoredColumns.includes(row.source);
              return (
                <div key={row.source} className={`data-transfer-map-row ${ignored ? "is-ignored" : ""}`}>
                  <span className="font-mono text-xs">{row.source}</span>
                  <span className="data-transfer-map-arrow" aria-hidden>
                    →
                  </span>
                  <span>{ignored ? "Ignored" : row.field}</span>
                  <span className="data-transfer-map-badge">{ignored ? "—" : "✓"}</span>
                  <button
                    type="button"
                    className="data-transfer-link-btn"
                    onClick={() =>
                      setIgnoredColumns((prev) =>
                        prev.includes(row.source) ? prev.filter((c) => c !== row.source) : [...prev, row.source]
                      )
                    }
                  >
                    {ignored ? "Map" : "Ignore"}
                  </button>
                </div>
              );
            })}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("analysis")}
            confirmLabel="Review validation"
            onConfirm={() => setStep("validation")}
          />
        </div>
      ) : null}

      {step === "validation" && preview ? (
        <div className="space-y-4">
          <div className="data-transfer-val-block">
            <p className="data-transfer-block-label">Errors · prevent import</p>
            {errors.length === 0 ? (
              <p className="data-transfer-empty-inline">No blocking errors.</p>
            ) : (
              <ul className="data-transfer-issue-list">
                {errors.slice(0, 12).map((issue, idx) => (
                  <li key={`e-${issue.line}-${idx}`}>
                    <button
                      type="button"
                      className="data-transfer-issue-btn"
                      onClick={() => setExpandedIssue(expandedIssue === idx ? null : idx)}
                    >
                      <span>
                        Row {issue.line}
                        {expandedIssue === idx ? `: ${issue.message}` : ` — ${issue.message}`}
                      </span>
                    </button>
                    {expandedIssue === idx ? (
                      <div className="data-transfer-issue-detail">
                        <p>{issue.message}</p>
                        <p className="data-transfer-issue-code">{issue.code}</p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="data-transfer-val-block">
            <p className="data-transfer-block-label">Warnings · review recommended</p>
            {warnings.length === 0 ? (
              <p className="data-transfer-empty-inline">No warnings.</p>
            ) : (
              <ul className="data-transfer-issue-list data-transfer-issue-list--warn">
                {warnings.slice(0, 8).map((issue, idx) => (
                  <li key={`w-${issue.line}-${idx}`}>
                    Row {issue.line}: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!canProceedPastValidation ? (
            <ProfileModalNote>Fix mapping or skip invalid rows before importing. You can still go back and adjust the file.</ProfileModalNote>
          ) : null}
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("mapping")}
            confirmLabel="Continue"
            confirmDisabled={!canProceedPastValidation}
            onConfirm={() => setStep("conflict")}
          />
        </div>
      ) : null}

      {step === "conflict" ? (
        <div className="space-y-4">
          <p className="data-transfer-block-label">When records already exist</p>
          <div className="data-transfer-choice-stack">
            {(catalog?.conflictStrategies ?? []).map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={c.availability !== "available"}
                className={`data-transfer-choice ${conflictStrategy === c.key ? "is-selected" : ""}`}
                onClick={() => setConflictStrategy(c.key)}
              >
                <span className="data-transfer-choice-title">{c.label}</span>
                <span className="data-transfer-choice-desc">
                  {c.key === "skip"
                    ? "Leave existing records unchanged and import only new ones."
                    : c.availability !== "available"
                      ? "Coming soon for this venue."
                      : c.label}
                </span>
              </button>
            ))}
          </div>
          <div className="data-transfer-source-block">
            <p className="data-transfer-block-label">Match existing by</p>
            <div className="data-transfer-source-grid">
              {[
                { id: "serveos_id", label: "ServeOS ID", soon: true },
                { id: "external_id", label: "External ID", soon: true },
                { id: "sku", label: "SKU", soon: true },
                { id: "name_category", label: "Name + category", soon: false }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={m.soon}
                  className={`data-transfer-source-pill ${matchBy === m.id ? "is-selected" : ""} ${m.soon ? "is-planned" : ""}`}
                  onClick={() => setMatchBy(m.id)}
                >
                  {m.label}
                  {m.soon ? " · soon" : ""}
                </button>
              ))}
            </div>
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("validation")}
            confirmLabel="Preview changes"
            onConfirm={() => setStep("preview")}
          />
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="space-y-4">
          <div className="data-transfer-preview-grid">
            <div className="data-transfer-preview-card">
              <p className="data-transfer-block-label">Will create</p>
              <ul>
                <li>~{createEst.categories} categories</li>
                <li>~{createEst.items} items</li>
                <li>~{createEst.modifiers} modifier rows</li>
              </ul>
            </div>
            <div className="data-transfer-preview-card">
              <p className="data-transfer-block-label">Will skip</p>
              <ul>
                <li>Existing matches ({conflictStrategy === "skip" ? "skip strategy" : conflictStrategy})</li>
                <li>{preview.errorCount} invalid rows</li>
              </ul>
            </div>
            <div className="data-transfer-preview-card data-transfer-preview-card--safe">
              <p className="data-transfer-block-label">Will not change</p>
              <ul>
                <li>Published menu versions</li>
                <li>Existing orders</li>
                <li>Historical audit records</li>
              </ul>
            </div>
          </div>
          <ProfileModalNote>
            Estimates are based on validated rows. Final counts appear after the import finishes.
          </ProfileModalNote>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("conflict")}
            confirmLabel="Review confirmation"
            onConfirm={() => setStep("confirm")}
          />
        </div>
      ) : null}

      {step === "confirm" && preview ? (
        <div className="space-y-4">
          <div className="data-transfer-confirm-card">
            <p>
              You&apos;re about to process <strong>{preview.validRows.toLocaleString()}</strong> valid rows
              {preview.warningCount ? ` with ${preview.warningCount} warnings` : ""}.
            </p>
            <dl className="data-transfer-kv">
              <div>
                <dt>Import into</dt>
                <dd>{venueName || "This venue"}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>Draft {selectedTarget?.label ?? "menu"} data</dd>
              </div>
              <div>
                <dt>Conflict strategy</dt>
                <dd>{catalog?.conflictStrategies.find((c) => c.key === conflictStrategy)?.label ?? conflictStrategy}</dd>
              </div>
            </dl>
          </div>
          <ProfileModalNote>
            Never auto-publishes. Imported menu changes stay in draft until you use Menu → Publish.
          </ProfileModalNote>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              disabled={busy || !canEdit}
              onClick={() => void runImport(true)}
            >
              Validate without importing
            </button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                disabled={busy}
                onClick={() => setStep("preview")}
              >
                Back
              </button>
              <button
                type="button"
                className="admin-profile-modal-btn admin-profile-modal-btn--primary"
                disabled={busy || !canEdit || !canProceedPastValidation}
                onClick={() => void runImport(false)}
              >
                Start import
              </button>
            </div>
          </div>
          {!canEdit ? <p className="text-sm text-amber-700">Your role can preview but not write imports.</p> : null}
        </div>
      ) : null}

      {step === "running" ? (
        <ConfigDrawerSpinner label={`Importing ${selectedTarget?.label ?? "data"}`} />
      ) : null}

      {step === "done" ? (
        <div className="space-y-4">
          <div className="data-transfer-done-hero">
            <div className="media-final-loader mx-auto" aria-hidden />
            <p className="data-transfer-done-title">Import completed</p>
            <p className="data-transfer-done-sub">{resultSummary}</p>
            {resultJobId ? <p className="data-transfer-done-meta">Job {resultJobId.slice(0, 8)}…</p> : null}
          </div>
          <div className="data-transfer-stat-row">
            <div className="data-transfer-mini-stat is-success">
              <span>{preview?.validRows.toLocaleString() ?? "—"}</span>
              <span>imported / valid</span>
            </div>
            <div className="data-transfer-mini-stat is-warning">
              <span>{preview?.warningCount.toLocaleString() ?? "0"}</span>
              <span>warnings</span>
            </div>
            <div className="data-transfer-mini-stat is-danger">
              <span>{preview?.errorCount.toLocaleString() ?? "0"}</span>
              <span>errors / skipped</span>
            </div>
          </div>
          <ProfileModalFooter
            cancelLabel="Import another"
            onCancel={() => {
              setFile(null);
              setPreview(null);
              setResultSummary(null);
              setStep("type");
            }}
            confirmLabel="Done"
            onConfirm={close}
          />
        </div>
      ) : null}
    </MenuPageModalShell>
  );
}
