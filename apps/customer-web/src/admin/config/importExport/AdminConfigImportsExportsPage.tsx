import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getImportExportCatalog,
  listDataTransferJobs,
  exportDataTransferTarget,
  previewDataTransferImport,
  runDataTransferImport,
  type DataTransferJobRow,
  type ImportExportCatalog,
  type MenuCsvPreview
} from "../../../api";
import {
  AdminEmptyState,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader,
  AdminSelect,
  AdminBtnPrimary,
  AdminBtnSecondary,
  subPanelCls
} from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { useMenuCapabilities } from "../useMenuCapabilities";
import {
  CONFIG_PRESET_DESCRIPTIONS,
  IMPORTS_EXPORTS_TAB_LABELS,
  IMPORTS_EXPORTS_TABS,
  type ImportsExportsSectionTab
} from "../configRouting";
import { MenuSection, MenuActionRow, MenuToolbarButton, MenuChip } from "../menu/MenuPageUi";
import { ADMIN_NAV_SYNC_EVENT, parseAdminHashQuery } from "../../adminWorkspaceRouting";

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName?: string;
};

const TAB_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

function isImportsExportsTab(value: string | null): value is ImportsExportsSectionTab {
  return Boolean(value && (IMPORTS_EXPORTS_TABS as string[]).includes(value));
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function PlannedNote({ children }: { children: string }) {
  return <p className="admin-config-text-subtle text-sm">{children}</p>;
}

export function AdminConfigImportsExportsPage({ token, restaurantId, venueName = "" }: Props) {
  const { pushToast } = useAdminToast();
  const caps = useMenuCapabilities(token, restaurantId);
  const canView = caps.can("menu", "view");
  const canEdit = caps.can("menu", "edit");

  const [tab, setTab] = useState<ImportsExportsSectionTab>("imports");
  const [catalog, setCatalog] = useState<ImportExportCatalog | null>(null);
  const [jobs, setJobs] = useState<DataTransferJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importTarget, setImportTarget] = useState("menu");
  const [importSource, setImportSource] = useState("csv");
  const [conflictStrategy, setConflictStrategy] = useState("skip");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MenuCsvPreview | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const [exportTarget, setExportTarget] = useState("menu");
  const [exportFormat, setExportFormat] = useState("csv");

  const reload = useCallback(async () => {
    if (!token || !restaurantId) return;
    setLoading(true);
    setError(null);
    const [catalogRes, jobsRes] = await Promise.all([
      getImportExportCatalog(token, restaurantId),
      listDataTransferJobs(token, restaurantId, { limit: 50 })
    ]);
    setLoading(false);
    if (!catalogRes.ok || !catalogRes.catalog) {
      setError(catalogRes.message ?? catalogRes.error ?? "Could not load import/export catalog");
      return;
    }
    setCatalog(catalogRes.catalog);
    if (jobsRes.ok) setJobs(jobsRes.jobs ?? []);
  }, [token, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const applyHash = () => {
      const q = parseAdminHashQuery();
      const next = q.get("tab");
      if (isImportsExportsTab(next)) setTab(next);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener(ADMIN_NAV_SYNC_EVENT, applyHash as EventListener);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener(ADMIN_NAV_SYNC_EVENT, applyHash as EventListener);
    };
  }, []);

  const importTargets = useMemo(
    () => (catalog?.targets ?? []).filter((t) => t.directions.includes("import")),
    [catalog]
  );
  const exportTargets = useMemo(
    () => (catalog?.targets ?? []).filter((t) => t.directions.includes("export")),
    [catalog]
  );

  const selectedImportTarget = importTargets.find((t) => t.key === importTarget);
  const selectedExportTarget = exportTargets.find((t) => t.key === exportTarget);
  const importReady =
    selectedImportTarget?.availability === "available" &&
    (catalog?.sources.find((s) => s.key === importSource)?.availability === "available");
  const exportReady =
    selectedExportTarget?.availability === "available" &&
    selectedExportTarget.formats.includes(exportFormat) &&
    (catalog?.formats.find((f) => f.key === exportFormat)?.availability === "available");

  const runPreview = async () => {
    if (!token || !restaurantId || !selectedFile || !importReady) return;
    setBusy(true);
    setLastSummary(null);
    const csv = await selectedFile.text();
    const res = await previewDataTransferImport(token, restaurantId, importTarget, {
      csv,
      sourceFormat: importSource,
      fileName: selectedFile.name
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Validation failed", "error");
      return;
    }
    setPreview(res.preview ?? null);
    pushToast("Dry run complete — no database writes.", "success");
    void reload();
  };

  const runImport = async () => {
    if (!token || !restaurantId || !selectedFile || !importReady || !canEdit) return;
    setBusy(true);
    setLastSummary(null);
    const csv = await selectedFile.text();
    const res = await runDataTransferImport(token, restaurantId, importTarget, {
      csv,
      sourceFormat: importSource,
      fileName: selectedFile.name,
      dryRun: false,
      conflictStrategy: conflictStrategy as "skip"
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Import failed", "error");
      setPreview(res.preview ?? null);
      return;
    }
    setPreview(res.preview ?? null);
    const s = res.summary;
    setLastSummary(
      s
        ? `${s.rows} rows · ${s.imported ?? 0} created · ${s.skipped ?? 0} skipped · ${s.failed ?? 0} failed`
        : `Imported ${res.imported?.rows ?? 0} rows.`
    );
    pushToast("Import completed.", "success");
    setSelectedFile(null);
    void reload();
  };

  const runExport = async () => {
    if (!token || !restaurantId || !exportReady) return;
    setBusy(true);
    const res = await exportDataTransferTarget(token, restaurantId, exportTarget, exportFormat);
    setBusy(false);
    if (!res.ok || !res.csv) {
      pushToast(res.message ?? "Export failed", "error");
      return;
    }
    downloadTextFile(
      `${exportTarget}-${restaurantId}.${exportFormat === "csv" ? "csv" : exportFormat}`,
      res.csv,
      "text/csv;charset=utf-8"
    );
    pushToast("Export ready.", "success");
    void reload();
  };

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
        <AdminSectionHeader
          eyebrowText="Configuration"
          title="Imports & Exports"
          description={CONFIG_PRESET_DESCRIPTIONS["imports-exports"]}
        />
        <div className={`${subPanelCls} admin-config-section mt-8 p-6`}>
          <AdminEmptyState>Sign in and select a venue to transfer data.</AdminEmptyState>
        </div>
      </AdminPanel>
    );
  }

  if (!canView) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
        <AdminSectionHeader
          eyebrowText="Configuration"
          title="Imports & Exports"
          description={CONFIG_PRESET_DESCRIPTIONS["imports-exports"]}
        />
        <AdminEmptyState>Your role cannot view Imports & Exports.</AdminEmptyState>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="Imports & Exports"
        description={
          venueName
            ? `${CONFIG_PRESET_DESCRIPTIONS["imports-exports"]} · ${venueName}`
            : CONFIG_PRESET_DESCRIPTIONS["imports-exports"]
        }
        action={
          <AdminRefreshButton onRefresh={() => void reload()} refreshing={loading} label="Sync transfer data" />
        }
      />

      {error ? (
        <div className={`${subPanelCls} admin-config-section mt-6 p-4`}>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      <div
        className="admin-config-tabs admin-menu-tabs mt-5 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Imports and exports sections"
      >
        {IMPORTS_EXPORTS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`admin-page-tab shrink-0 ${tab === t ? "admin-page-tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {IMPORTS_EXPORTS_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          className="mt-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TAB_TRANSITION}
        >
          {tab === "imports" ? (
            <div className="admin-menu-tab-stack">
              <MenuSection
                title="Import data"
                description="Choose a target registered by the backend, then upload a source file. Validation runs server-side."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="admin-config-text-subtle">Target</span>
                    <AdminSelect
                      className="mt-1 w-full"
                      value={importTarget}
                      onChange={(e) => {
                        setImportTarget(e.target.value);
                        setPreview(null);
                        setLastSummary(null);
                      }}
                    >
                      {importTargets.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                          {t.availability === "planned" ? " (soon)" : ""}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                  <label className="block text-sm">
                    <span className="admin-config-text-subtle">Source</span>
                    <AdminSelect
                      className="mt-1 w-full"
                      value={importSource}
                      onChange={(e) => setImportSource(e.target.value)}
                    >
                      {(catalog?.sources ?? []).map((s) => (
                        <option key={s.key} value={s.key} disabled={s.availability !== "available"}>
                          {s.label}
                          {s.availability === "planned" ? " (soon)" : ""}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                  <label className="block text-sm">
                    <span className="admin-config-text-subtle">If item exists</span>
                    <AdminSelect
                      className="mt-1 w-full"
                      value={conflictStrategy}
                      onChange={(e) => setConflictStrategy(e.target.value)}
                    >
                      {(catalog?.conflictStrategies ?? []).map((c) => (
                        <option key={c.key} value={c.key} disabled={c.availability !== "available"}>
                          {c.label}
                          {c.availability === "planned" ? " (soon)" : ""}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                  <label className="block text-sm">
                    <span className="admin-config-text-subtle">Upload</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="mt-1 block w-full text-sm"
                      disabled={!importReady || busy}
                      onChange={(e) => {
                        setSelectedFile(e.target.files?.[0] ?? null);
                        setPreview(null);
                        setLastSummary(null);
                        e.target.value = "";
                      }}
                    />
                    {selectedFile ? (
                      <p className="mt-1 text-xs admin-config-text-subtle">{selectedFile.name}</p>
                    ) : null}
                  </label>
                </div>

                {!importReady ? (
                  <div className="mt-4">
                    <PlannedNote>
                      {selectedImportTarget?.description ??
                        "This target is registered for the future. Menu CSV is available today."}
                    </PlannedNote>
                  </div>
                ) : null}

                <MenuActionRow>
                  <MenuToolbarButton
                    disabled={!selectedFile || !importReady || busy}
                    onClick={() => void runPreview()}
                  >
                    Dry run (validate only)
                  </MenuToolbarButton>
                  {canEdit ? (
                    <MenuToolbarButton
                      primary
                      disabled={!selectedFile || !importReady || busy}
                      onClick={() => void runImport()}
                    >
                      Import data
                    </MenuToolbarButton>
                  ) : null}
                </MenuActionRow>

                {preview ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MenuChip>{preview.rowCount} rows</MenuChip>
                    <MenuChip tone="success">{preview.validRows} valid</MenuChip>
                    <MenuChip tone="muted">{preview.warningCount} warnings</MenuChip>
                    <MenuChip tone={preview.errorCount ? "violet" : "default"}>
                      {preview.errorCount} errors
                    </MenuChip>
                  </div>
                ) : null}

                {preview?.issues?.length ? (
                  <ul className="mt-4 max-h-48 space-y-1 overflow-auto text-sm">
                    {preview.issues.map((issue, idx) => (
                      <li key={`${issue.line}-${issue.code}-${idx}`} className="admin-config-text-subtle">
                        Line {issue.line}: {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {lastSummary ? <p className="mt-4 text-sm">{lastSummary}</p> : null}
              </MenuSection>
            </div>
          ) : null}

          {tab === "exports" ? (
            <div className="admin-menu-tab-stack">
              <MenuSection
                title="Export data"
                description="Download venue data. Large queued deliveries and cloud destinations come later."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="admin-config-text-subtle">Target</span>
                    <AdminSelect
                      className="mt-1 w-full"
                      value={exportTarget}
                      onChange={(e) => setExportTarget(e.target.value)}
                    >
                      {exportTargets.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                          {t.availability === "planned" ? " (soon)" : ""}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                  <label className="block text-sm">
                    <span className="admin-config-text-subtle">Format</span>
                    <AdminSelect
                      className="mt-1 w-full"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                    >
                      {(catalog?.formats ?? []).map((f) => (
                        <option key={f.key} value={f.key} disabled={f.availability !== "available"}>
                          {f.label}
                          {f.availability === "planned" ? " (soon)" : ""}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                </div>
                {!exportReady ? (
                  <div className="mt-4">
                    <PlannedNote>
                      {selectedExportTarget?.description ??
                        "This export target is planned. Menu CSV is available today."}
                    </PlannedNote>
                  </div>
                ) : null}
                <MenuActionRow>
                  <MenuToolbarButton primary disabled={!exportReady || busy} onClick={() => void runExport()}>
                    Download
                  </MenuToolbarButton>
                </MenuActionRow>
              </MenuSection>
            </div>
          ) : null}

          {tab === "templates" ? (
            <div className="admin-menu-tab-stack">
              <MenuSection
                title="Restaurant templates"
                description="ServeOS, community, and your own templates will land here."
              >
                <PlannedNote>
                  Templates are registered in the platform catalog but not fillable yet. Use Imports with Menu CSV for
                  now.
                </PlannedNote>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Breakfast Menu", "Lunch Menu", "Cocktail Menu", "Wine List", "Kids Menu"].map((name) => (
                    <MenuChip key={name} tone="muted">
                      {name}
                    </MenuChip>
                  ))}
                </div>
              </MenuSection>
            </div>
          ) : null}

          {tab === "migration" ? (
            <div className="admin-menu-tab-stack">
              <MenuSection
                title="POS migration"
                description="Migration remembers external IDs. Until provider connectors ship, use Custom CSV via Imports."
              >
                <div className="flex flex-wrap gap-2">
                  {(catalog?.migrationProviders ?? []).map((p) => (
                    <MenuChip key={p.key} tone={p.availability === "available" ? "success" : "muted"}>
                      {p.label}
                      {p.availability === "planned" ? " · soon" : ""}
                    </MenuChip>
                  ))}
                </div>
                <div className="mt-4">
                  <AdminBtnSecondary type="button" onClick={() => setTab("imports")}>
                    Open Imports (Custom CSV)
                  </AdminBtnSecondary>
                </div>
              </MenuSection>
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="admin-menu-tab-stack">
              <MenuSection
                title="Transfer history"
                description="Every import and export job for this venue. Undo windows will appear here when a target supports rollback."
              >
                {jobs.length === 0 ? (
                  <AdminEmptyState>No transfer jobs yet.</AdminEmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="admin-config-text-subtle border-b border-white/10">
                          <th className="py-2 pr-4 font-medium">Type</th>
                          <th className="py-2 pr-4 font-medium">Target</th>
                          <th className="py-2 pr-4 font-medium">Rows</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 pr-4 font-medium">Started</th>
                          <th className="py-2 pr-4 font-medium">Undo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job) => (
                          <tr key={job.id} className="border-b border-white/5">
                            <td className="py-2 pr-4">
                              {job.direction}
                              {job.dryRun ? " · dry run" : ""}
                            </td>
                            <td className="py-2 pr-4">{job.targetKey}</td>
                            <td className="py-2 pr-4">{job.rowCount}</td>
                            <td className="py-2 pr-4">{job.status}</td>
                            <td className="py-2 pr-4">{formatWhen(job.startedAt)}</td>
                            <td className="py-2 pr-4">{job.undoAvailable ? "Available" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4">
                  <AdminBtnPrimary type="button" disabled={loading} onClick={() => void reload()}>
                    Refresh history
                  </AdminBtnPrimary>
                </div>
              </MenuSection>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </AdminPanel>
  );
}
