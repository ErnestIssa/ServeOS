import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getImportExportCatalog,
  listDataTransferJobs,
  listDataTransferTemplates,
  exportDataTransferTarget,
  downloadDataTransferTemplate,
  duplicateDataTransferTemplate,
  deleteDataTransferTemplate,
  updateDataTransferTemplate,
  createDataTransferMigrationRequest,
  type DataTransferJobRow,
  type DataTransferTemplateRow,
  type ImportExportCatalog
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import {
  AdminEmptyState,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader,
  AdminBtnPrimary,
  AdminBtnSecondary,
  subPanelCls
} from "../../AdminUi";
import { AdminStaleContent } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import { useMenuCapabilities } from "../useMenuCapabilities";
import {
  CONFIG_PRESET_DESCRIPTIONS,
  IMPORTS_EXPORTS_TAB_LABELS,
  IMPORTS_EXPORTS_TABS,
  normalizeImportsExportsTab,
  type ImportsExportsSectionTab
} from "../configRouting";
import { MenuListSearchField } from "../menu/MenuPageUi";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { MenuPageModalShell, ProfileModalFooter, ProfileModalNote } from "../menu/menuPageModalShell";
import { matchesListSearch } from "../menu/menuListUiMocks";
import { useMenuListPagination } from "../menu/useMenuListPagination";
import { ADMIN_NAV_SYNC_EVENT, parseAdminHashQuery } from "../../adminWorkspaceRouting";
import { ImportWizardModal } from "./ImportWizardModal";
import { ExportWizardModal } from "./ExportWizardModal";
import { TransferOperationDetailsModal } from "./TransferOperationDetailsModal";
import { TransferManageDrawer } from "./TransferManageDrawer";
import { TransferActivityChart } from "./TransferActivityChart";
import { TransferTemplateFormModal } from "./TransferTemplateFormModal";
import { MigrationGuideModal } from "./MigrationGuideModal";
import { MigrationHelpChooserModal } from "./MigrationHelpChooserModal";
import { UI_MOCK_TRANSFER_JOBS, isUiOnlyTransferId } from "./transferListUiMocks";
import { UI_MOCK_TRANSFER_TEMPLATES, isUiOnlyTemplateId } from "./transferTemplateUiMocks";
import {
  TRANSFER_HISTORY_LIST_QUERY,
  TRANSFER_LIST_QUERY,
  applyTransferListFilters,
  applyTransferListSort
} from "./transferListQuery";
import {
  TRANSFER_TEMPLATE_LIST_QUERY,
  applyTransferTemplateFilters,
  applyTransferTemplateSort
} from "./transferTemplateListQuery";
import {
  MENU_CSV_TEMPLATE,
  canDownloadJob,
  canRetryJob,
  downloadTextFile,
  formatWhen,
  isJobActive,
  jobActorLabel,
  jobListDescription,
  jobOutcomeSummary,
  jobRecordLabel,
  jobStatusLabel,
  jobSurfaceStatusClass,
  jobTitle,
  jobWhenLabel,
  templateListDescription,
  templateMetaLabel,
  templateStatusLabel,
  templateSurfaceStatusClass
} from "./transferUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName?: string;
};

const TAB_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

export function AdminConfigImportsExportsPage({ token, restaurantId, venueName = "" }: Props) {
  const { pushToast } = useAdminToast();
  const caps = useMenuCapabilities(token, restaurantId);
  const canView = caps.can("menu", "view");
  const canEdit = caps.can("menu", "edit");

  const [tab, setTab] = useState<ImportsExportsSectionTab>("overview");
  const [catalog, setCatalog] = useState<ImportExportCatalog | null>(null);
  const [jobs, setJobs] = useState<DataTransferJobRow[]>([]);
  const [templates, setTemplates] = useState<DataTransferTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<DataTransferJobRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(TRANSFER_LIST_QUERY.defaultSort);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyFilters, setHistoryFilters] = useState<string[]>([]);
  const [historySort, setHistorySort] = useState(TRANSFER_HISTORY_LIST_QUERY.defaultSort);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templateFilters, setTemplateFilters] = useState<string[]>([]);
  const [templateSort, setTemplateSort] = useState(TRANSFER_TEMPLATE_LIST_QUERY.defaultSort);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState("menu");
  const [exportTarget, setExportTarget] = useState("menu");
  const [moreOpen, setMoreOpen] = useState(false);
  const [manualMigrationOpen, setManualMigrationOpen] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [migrationProviderKey, setMigrationProviderKey] = useState("custom-csv");
  const [migrationHelpChooserOpen, setMigrationHelpChooserOpen] = useState(false);
  const [migrationGuideOpen, setMigrationGuideOpen] = useState(false);
  const MANUAL_MIGRATION_VALUE = "__request-manual__";
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const skipNextActivityRefresh = useRef(true);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templateFormMode, setTemplateFormMode] = useState<"create" | "edit">("create");
  const [editingTemplate, setEditingTemplate] = useState<DataTransferTemplateRow | null>(null);

  const MORE_ACTIONS = [
    { id: "export", label: "Export data" },
    { id: "download", label: "Download" },
    { id: "supported-migrations", label: "Supported migrations" },
    { id: "request-manual-migration", label: "Request manual migration" }
  ] as const;

  const reload = useCallback(async () => {
    if (!token || !restaurantId) return;
    setLoading(true);
    setError(null);
    const [catalogRes, jobsRes, templatesRes] = await Promise.all([
      getImportExportCatalog(token, restaurantId),
      listDataTransferJobs(token, restaurantId, { limit: 200 }),
      listDataTransferTemplates(token, restaurantId, { includeArchived: true })
    ]);
    setLoading(false);
    setLoadedOnce(true);
    if (!catalogRes.ok || !catalogRes.catalog) {
      setError(catalogRes.message ?? catalogRes.error ?? "Could not load import/export catalog");
      return;
    }
    setCatalog(catalogRes.catalog);
    if (jobsRes.ok) setJobs(jobsRes.jobs ?? []);
    if (templatesRes.ok) setTemplates(templatesRes.templates ?? []);
    if (skipNextActivityRefresh.current) {
      skipNextActivityRefresh.current = false;
    } else {
      setActivityRefreshKey((k) => k + 1);
    }
  }, [token, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const applyHash = () => {
      const q = parseAdminHashQuery();
      const next = normalizeImportsExportsTab(q.get("tab"));
      if (next) setTab(next);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener(ADMIN_NAV_SYNC_EVENT, applyHash as EventListener);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener(ADMIN_NAV_SYNC_EVENT, applyHash as EventListener);
    };
  }, []);

  const allOperations = useMemo(() => [...jobs, ...UI_MOCK_TRANSFER_JOBS], [jobs]);

  const filteredOperations = useMemo(() => {
    const searched = allOperations.filter((job) =>
      matchesListSearch(
        searchQuery,
        jobTitle(job, catalog),
        job.fileName,
        job.targetKey,
        job.direction,
        jobStatusLabel(job),
        jobActorLabel(job)
      )
    );
    const filtered = applyTransferListFilters(searched, activeFilters);
    return applyTransferListSort(filtered, activeSort, catalog);
  }, [allOperations, searchQuery, activeFilters, activeSort, catalog]);

  const filteredHistory = useMemo(() => {
    const searched = allOperations.filter((job) =>
      matchesListSearch(
        historySearchQuery,
        jobTitle(job, catalog),
        job.fileName,
        job.targetKey,
        job.direction,
        jobStatusLabel(job),
        jobOutcomeSummary(job),
        jobActorLabel(job),
        jobWhenLabel(job)
      )
    );
    const filtered = applyTransferListFilters(searched, historyFilters);
    return applyTransferListSort(filtered, historySort, catalog);
  }, [allOperations, historySearchQuery, historyFilters, historySort, catalog]);

  const pager = useMenuListPagination(filteredOperations, {
    resetKey: `${searchQuery.trim().toLowerCase()}:${activeFilters.join(",")}:${activeSort}`
  });

  const historyPager = useMenuListPagination(filteredHistory, {
    resetKey: `${historySearchQuery.trim().toLowerCase()}:${historyFilters.join(",")}:${historySort}`
  });

  const allTemplates = useMemo(() => [...templates, ...UI_MOCK_TRANSFER_TEMPLATES], [templates]);

  const filteredTemplates = useMemo(() => {
    const searched = allTemplates.filter((row) =>
      matchesListSearch(
        templateSearchQuery,
        row.name,
        row.description,
        row.targetKey,
        row.targetLabel,
        row.format,
        templateStatusLabel(row),
        row.isSystem ? "system" : "custom"
      )
    );
    const filtered = applyTransferTemplateFilters(searched, templateFilters);
    return applyTransferTemplateSort(filtered, templateSort);
  }, [allTemplates, templateSearchQuery, templateFilters, templateSort]);

  const templatePager = useMenuListPagination(filteredTemplates, {
    resetKey: `${templateSearchQuery.trim().toLowerCase()}:${templateFilters.join(",")}:${templateSort}`
  });

  const allPageSelected =
    pager.pagedItems.length > 0 && pager.pagedItems.every((j) => selectedIds.has(j.id));
  const hasSelection = selectedIds.size > 0;

  const historyAllPageSelected =
    historyPager.pagedItems.length > 0 && historyPager.pagedItems.every((j) => selectedIds.has(j.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const pageItems = tab === "history" ? historyPager.pagedItems : pager.pagedItems;
    const allSelected =
      pageItems.length > 0 && pageItems.every((j) => selectedIds.has(j.id));
    const some = pageItems.some((j) => selectedIds.has(j.id));
    el.indeterminate = some && !allSelected;
  }, [tab, pager.pagedItems, historyPager.pagedItems, selectedIds]);

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllPage = (checked: boolean, scope: "overview" | "history" = "overview") => {
    const pageItems = scope === "history" ? historyPager.pagedItems : pager.pagedItems;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const job of pageItems) {
        if (checked) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  };

  const openImport = (target = "menu") => {
    setImportTarget(target);
    setImportOpen(true);
  };
  const openExport = (target = "menu") => {
    setExportTarget(target);
    setExportOpen(true);
  };

  const handleMoreAction = (actionId: string) => {
    setMoreOpen(false);
    switch (actionId) {
      case "export":
        openExport("menu");
        break;
      case "download":
        downloadTextFile("serveos-menu-template.csv", MENU_CSV_TEMPLATE, "text/csv;charset=utf-8");
        pushToast("Template downloaded.", "success");
        break;
      case "supported-migrations":
        setTab("migration");
        break;
      case "request-manual-migration":
        setManualNote("");
        setManualMigrationOpen(true);
        break;
      default:
        break;
    }
  };

  const migrationProviderOptions = useMemo(() => {
    const providers = (catalog?.migrationProviders ?? []).map((p) => ({
      value: p.key,
      label: p.availability === "planned" ? `${p.label} · soon` : p.label,
      hint: p.description ?? (p.availability === "available" ? "Available now" : "Connector coming soon")
    }));
    return [
      ...providers,
      {
        value: MANUAL_MIGRATION_VALUE,
        label: "Request manual migration",
        hint: "Ask ServeOS to help migrate from your current system"
      }
    ];
  }, [catalog]);

  const selectedMigrationProvider = useMemo(
    () => (catalog?.migrationProviders ?? []).find((p) => p.key === migrationProviderKey) ?? null,
    [catalog, migrationProviderKey]
  );

  const openManualMigration = (prefillProvider?: string) => {
    const label =
      (catalog?.migrationProviders ?? []).find((p) => p.key === prefillProvider)?.label ??
      prefillProvider ??
      "";
    setManualNote(label ? `Migrating from ${label}. ` : "");
    setManualMigrationOpen(true);
  };

  const handleMigrationProviderChange = (value: string) => {
    if (value === MANUAL_MIGRATION_VALUE) {
      openManualMigration(
        migrationProviderKey !== MANUAL_MIGRATION_VALUE ? migrationProviderKey : undefined
      );
      return;
    }
    setMigrationProviderKey(value);
  };

  const startMigration = () => {
    if (migrationProviderKey === MANUAL_MIGRATION_VALUE) {
      openManualMigration();
      return;
    }
    const provider = selectedMigrationProvider;
    if (!provider) {
      pushToast("Choose a source system first.", "error");
      return;
    }
    if (provider.availability === "available" && provider.key === "custom-csv") {
      openImport("menu");
      return;
    }
    openManualMigration(provider.key);
  };

  const submitManualMigrationRequest = async () => {
    if (!token || !restaurantId) return;
    setManualBusy(true);
    const providerKey =
      migrationProviderKey === MANUAL_MIGRATION_VALUE
        ? "manual"
        : migrationProviderKey || "manual";
    const res = await createDataTransferMigrationRequest(token, restaurantId, {
      providerKey,
      note: manualNote.trim() || null
    });
    setManualBusy(false);
    if (!res.ok || !res.request) {
      pushToast(res.message ?? res.error ?? "Could not send migration request", "error");
      return;
    }
    setManualMigrationOpen(false);
    setManualNote("");
    pushToast("Manual migration request sent. ServeOS will follow up.", "success");
  };

  const redownloadExport = async (job: DataTransferJobRow) => {
    if (!token || !restaurantId) return;
    const format = job.sourceFormat || "csv";
    const res = await exportDataTransferTarget(token, restaurantId, job.targetKey, format);
    if (!res.ok || !res.csv) {
      pushToast(res.message ?? "Could not prepare download", "error");
      return;
    }
    downloadTextFile(`${job.targetKey}-${restaurantId}.csv`, res.csv, "text/csv;charset=utf-8");
    pushToast("Download started.", "success");
  };

  const operationRowActions = (job: DataTransferJobRow) => {
    const actions: Array<{ id: string; label: string; danger?: boolean }> = [
      { id: "view", label: job.warningCount > 0 ? "Review" : "View details" }
    ];
    if (canDownloadJob(job)) actions.push({ id: "download", label: "Download" });
    if (canRetryJob(job)) actions.push({ id: "retry", label: job.direction === "IMPORT" ? "Retry import" : "Retry export" });
    if (job.undoAvailable) actions.push({ id: "undo", label: "Undo import", danger: true });
    return actions;
  };

  const openManageForJob = (job: DataTransferJobRow) => {
    setOpenActionsId(null);
    setSelectedIds(new Set([job.id]));
    setManageOpen(true);
  };

  const retryJob = (job: DataTransferJobRow) => {
    if (isUiOnlyTransferId(job.id)) {
      pushToast(
        job.direction === "IMPORT"
          ? "Preview only — retry will open the import wizard for real failed jobs."
          : "Preview only — retry will open the export wizard for real failed jobs.",
        "success"
      );
    }
    if (job.direction === "IMPORT") openImport(job.targetKey || "menu");
    else openExport(job.targetKey || "menu");
  };

  const handleOperationAction = (job: DataTransferJobRow, actionId: string) => {
    setOpenActionsId(null);
    if (actionId === "view") {
      setSelectedJob(job);
      return;
    }
    if (actionId === "download") {
      if (isUiOnlyTransferId(job.id)) {
        pushToast("Preview only — download will work with real exports.", "success");
        return;
      }
      void redownloadExport(job);
      return;
    }
    if (actionId === "retry") {
      retryJob(job);
      return;
    }
    if (actionId === "undo") {
      pushToast(
        isUiOnlyTransferId(job.id)
          ? "Preview only — undo will appear for reversible imports."
          : "Undo is not available for this operation yet.",
        "error"
      );
    }
  };

  const openCreateTemplate = () => {
    setTemplateFormMode("create");
    setEditingTemplate(null);
    setTemplateFormOpen(true);
  };

  const openEditTemplate = (row: DataTransferTemplateRow) => {
    if (isUiOnlyTemplateId(row.id)) {
      pushToast("Preview only — edit works on real templates from the server.", "success");
      return;
    }
    setTemplateFormMode("edit");
    setEditingTemplate(row);
    setTemplateFormOpen(true);
  };

  const templateRowActions = (row: DataTransferTemplateRow) => {
    const actions: Array<{ id: string; label: string; danger?: boolean }> = [
      { id: "download", label: "Download" },
      { id: "use-import", label: "Use in import" },
      { id: "edit", label: "Edit" },
      { id: "duplicate", label: "Duplicate" }
    ];
    if (row.status !== "ARCHIVED") {
      actions.push({ id: "archive", label: "Archive" });
    } else {
      actions.push({ id: "activate", label: "Restore to active" });
    }
    if (!row.isSystem) actions.push({ id: "delete", label: "Delete", danger: true });
    return actions;
  };

  const handleTemplateAction = async (row: DataTransferTemplateRow, actionId: string) => {
    setOpenActionsId(null);
    if (!token || !restaurantId) return;

    if (actionId === "download") {
      if (isUiOnlyTemplateId(row.id)) {
        downloadTextFile(
          `${row.name.replace(/[^\w.-]+/g, "-").toLowerCase() || "template"}.csv`,
          row.content,
          "text/csv;charset=utf-8"
        );
        pushToast("Preview template downloaded.", "success");
        return;
      }
      const res = await downloadDataTransferTemplate(token, restaurantId, row.id);
      if (!res.ok || !res.csv) {
        pushToast(res.message ?? "Could not download template", "error");
        return;
      }
      downloadTextFile(res.fileName, res.csv, "text/csv;charset=utf-8");
      pushToast("Template downloaded.", "success");
      return;
    }

    if (actionId === "use-import") {
      openImport(row.targetKey || "menu");
      return;
    }

    if (actionId === "edit") {
      openEditTemplate(row);
      return;
    }

    if (actionId === "duplicate") {
      if (isUiOnlyTemplateId(row.id)) {
        pushToast("Preview only — duplicate works on real templates from the server.", "success");
        return;
      }
      if (!canEdit) {
        pushToast("You don’t have permission to create templates.", "error");
        return;
      }
      const res = await duplicateDataTransferTemplate(token, restaurantId, row.id);
      if (!res.ok || !res.template) {
        pushToast(res.message ?? "Could not duplicate template", "error");
        return;
      }
      pushToast("Template duplicated.", "success");
      void reload();
      return;
    }

    if (actionId === "archive" || actionId === "activate") {
      if (isUiOnlyTemplateId(row.id)) {
        pushToast("Preview only — status changes apply to real templates.", "success");
        return;
      }
      if (!canEdit) {
        pushToast("You don’t have permission to update templates.", "error");
        return;
      }
      const res = await updateDataTransferTemplate(token, restaurantId, row.id, {
        status: actionId === "archive" ? "ARCHIVED" : "ACTIVE"
      });
      if (!res.ok || !res.template) {
        pushToast(res.message ?? "Could not update template", "error");
        return;
      }
      pushToast(actionId === "archive" ? "Template archived." : "Template restored.", "success");
      void reload();
      return;
    }

    if (actionId === "delete") {
      if (isUiOnlyTemplateId(row.id)) {
        pushToast("Preview only — delete works on real custom templates.", "success");
        return;
      }
      if (row.isSystem) {
        pushToast("Platform templates cannot be deleted.", "error");
        return;
      }
      if (!canEdit) {
        pushToast("You don’t have permission to delete templates.", "error");
        return;
      }
      const res = await deleteDataTransferTemplate(token, restaurantId, row.id);
      if (!res.ok) {
        pushToast(res.message ?? "Could not delete template", "error");
        return;
      }
      pushToast("Template deleted.", "success");
      void reload();
    }
  };

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-data-transfer-page">
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
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-data-transfer-page">
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
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-data-transfer-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="Imports & Exports"
        description="Import, export, and review venue data transfers."
        action={
          <AdminRefreshButton onRefresh={() => void reload()} refreshing={loading} label="Sync transfer data" />
        }
      />

      {error ? (
        <div className={`${subPanelCls} admin-config-section mt-6 p-4`}>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="data-transfer-tab-bar mt-5 flex items-center justify-between gap-3">
        <div
          className="admin-config-tabs admin-menu-tabs flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1"
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
        <div className="admin-menu-surface-board-actions shrink-0">
          <AdminBtnPrimary type="button" onClick={() => openImport("menu")}>
            Import data
          </AdminBtnPrimary>
          <MenuEntityActionsMenu
            entityName="Imports & Exports"
            hideHeader
            dotsOrientation="vertical"
            open={moreOpen}
            actions={[...MORE_ACTIONS]}
            onToggle={() => setMoreOpen((v) => !v)}
            onAction={handleMoreAction}
          />
        </div>
      </div>

      <AdminStaleContent refreshing={loading && loadedOnce}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="mt-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={TAB_TRANSITION}
          >
            {tab === "overview" ? (
              <div className="admin-menu-tab-stack data-transfer-overview">
                <TransferActivityChart
                  token={token}
                  restaurantId={restaurantId}
                  refreshKey={activityRefreshKey}
                />

                <div className="admin-menu-surface-board data-transfer-recent-board">
                  <div className="admin-menu-surface-board-head">
                    <div className="min-w-0">
                      <h3 className="admin-menu-surface-board-title">Recent operations</h3>
                      <p className="admin-menu-surface-board-desc">
                        Imports, exports, and validations for this venue — newest first.
                      </p>
                    </div>
                    <div className="admin-menu-surface-board-actions">
                      <AdminBtnSecondary type="button" onClick={() => setManageOpen(true)}>
                        {hasSelection ? "Manage selected" : "Manage"}
                      </AdminBtnSecondary>
                    </div>
                  </div>

                  {allOperations.length > 0 ? (
                    <MenuListSearchField
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search operations by name, file, status, or user…"
                      aria-label="Search recent operations"
                      filterGroups={TRANSFER_LIST_QUERY.filterGroups}
                      sortOptions={TRANSFER_LIST_QUERY.sortOptions}
                      defaultSort={TRANSFER_LIST_QUERY.defaultSort}
                      activeFilters={activeFilters}
                      activeSort={activeSort}
                      totalCount={allOperations.length}
                      resultCount={filteredOperations.length}
                      onFiltersChange={setActiveFilters}
                      onSortChange={setActiveSort}
                      filterTitle="Filter operations"
                      filterSubtitle="Narrow by type, status, and data set."
                      sortTitle="Sort operations"
                      sortSubtitle="Changes apply to the list instantly."
                    />
                  ) : null}

                  {allOperations.length === 0 ? (
                    <AdminEmptyState>No transfer jobs yet. Start with Import data or Create export.</AdminEmptyState>
                  ) : filteredOperations.length === 0 ? (
                    <p className="admin-config-text-muted py-2 text-sm">No operations match your search or filters.</p>
                  ) : (
                    <>
                      <label className="admin-menu-surface-select-all">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="admin-menu-surface-checkbox"
                          checked={allPageSelected}
                          aria-label="Select all operations on this page"
                          onChange={(e) => toggleSelectAllPage(e.target.checked, "overview")}
                        />
                        <span className="admin-menu-surface-select-all-label">Select all on page</span>
                      </label>

                      <ul className={`admin-menu-surface-list ${pager.pageClassName}`} key={pager.pageKey}>
                        {pager.pagedItems.map((job, index) => {
                          const title = jobTitle(job, catalog);
                          const desc = jobListDescription(job);
                          const stats = [
                            jobRecordLabel(job),
                            formatWhen(job.startedAt),
                            `Started by ${jobActorLabel(job)}`
                          ].join(" · ");
                          const isSelected = selectedIds.has(job.id);
                          const actions = operationRowActions(job);
                          return (
                            <li
                              key={job.id}
                              className="admin-menu-surface-list-item"
                              style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                            >
                              <div
                                className={`admin-menu-surface-card data-transfer-op-card${isSelected ? " is-selected" : ""}`}
                                role="button"
                                tabIndex={0}
                                aria-label={`Manage ${title}`}
                                onClick={() => openManageForJob(job)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openManageForJob(job);
                                  }
                                }}
                              >
                                <label
                                  className="admin-menu-surface-checkbox-wrap"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    className="admin-menu-surface-checkbox"
                                    checked={isSelected}
                                    aria-label={`Select ${title}`}
                                    onChange={(e) => toggleSelection(job.id, e.target.checked)}
                                  />
                                </label>

                                <span className={`admin-menu-surface-status ${jobSurfaceStatusClass(job)}`}>
                                  {jobStatusLabel(job)}
                                </span>

                                <div className="admin-menu-surface-main">
                                  <span className="admin-menu-surface-name">{title}</span>
                                  <span className="admin-menu-surface-sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="admin-menu-surface-desc">{desc}</span>
                                  <span className="admin-menu-surface-sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="admin-menu-surface-meta">{stats}</span>
                                </div>

                                <div
                                  className="admin-menu-surface-actions"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <MenuEntityActionsMenu
                                    entityName={title}
                                    hideHeader
                                    open={openActionsId === job.id}
                                    actions={actions}
                                    onToggle={() => setOpenActionsId((id) => (id === job.id ? null : job.id))}
                                    onAction={(actionId) => handleOperationAction(job, actionId)}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {pager.showPagination ? (
                        <MenuSurfacePagination
                          page={pager.page}
                          totalPages={pager.totalPages}
                          totalItems={pager.totalItems}
                          pageSize={pager.pageSize}
                          onPageChange={pager.goToPage}
                          label="Operations pagination"
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "history" ? (
              <div className="admin-menu-tab-stack data-transfer-history">
                <div className="admin-menu-surface-board data-transfer-history-board">
                  <div className="admin-menu-surface-board-head">
                    <div className="min-w-0">
                      <h3 className="admin-menu-surface-board-title">Transfer history</h3>
                      <p className="admin-menu-surface-board-desc">
                        What happened, whether it succeeded, if you can download or retry, and who ran it — newest first.
                      </p>
                    </div>
                    <div className="admin-menu-surface-board-actions">
                      <AdminBtnSecondary type="button" onClick={() => setManageOpen(true)}>
                        {hasSelection ? "Manage selected" : "Manage"}
                      </AdminBtnSecondary>
                    </div>
                  </div>

                  {allOperations.length > 0 ? (
                    <MenuListSearchField
                      value={historySearchQuery}
                      onChange={setHistorySearchQuery}
                      placeholder="Search by operation, file, status, person, or outcome…"
                      aria-label="Search transfer history"
                      filterGroups={TRANSFER_HISTORY_LIST_QUERY.filterGroups}
                      sortOptions={TRANSFER_HISTORY_LIST_QUERY.sortOptions}
                      defaultSort={TRANSFER_HISTORY_LIST_QUERY.defaultSort}
                      activeFilters={historyFilters}
                      activeSort={historySort}
                      totalCount={allOperations.length}
                      resultCount={filteredHistory.length}
                      onFiltersChange={setHistoryFilters}
                      onSortChange={setHistorySort}
                      filterTitle="Filter history"
                      filterSubtitle="Narrow by type and status — Import, Export, Running, Completed, Warnings, Failed."
                      sortTitle="Sort history"
                      sortSubtitle="Changes apply to the list instantly."
                    />
                  ) : null}

                  {allOperations.length === 0 ? (
                    <AdminEmptyState>No transfer history yet. Imports and exports will appear here.</AdminEmptyState>
                  ) : filteredHistory.length === 0 ? (
                    <p className="admin-config-text-muted py-2 text-sm">No operations match your search or filters.</p>
                  ) : (
                    <>
                      <label className="admin-menu-surface-select-all">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="admin-menu-surface-checkbox"
                          checked={historyAllPageSelected}
                          aria-label="Select all history operations on this page"
                          onChange={(e) => toggleSelectAllPage(e.target.checked, "history")}
                        />
                        <span className="admin-menu-surface-select-all-label">Select all on page</span>
                      </label>

                      <ul className={`admin-menu-surface-list ${historyPager.pageClassName}`} key={historyPager.pageKey}>
                        {historyPager.pagedItems.map((job, index) => {
                          const title = jobTitle(job, catalog);
                          const desc = jobListDescription(job);
                          const stats = [
                            jobOutcomeSummary(job),
                            jobRecordLabel(job),
                            jobWhenLabel(job),
                            `by ${jobActorLabel(job)}`
                          ].join(" · ");
                          const isSelected = selectedIds.has(job.id);
                          const actions = operationRowActions(job);
                          return (
                            <li
                              key={job.id}
                              className="admin-menu-surface-list-item"
                              style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                            >
                              <div
                                className={`admin-menu-surface-card data-transfer-op-card${isSelected ? " is-selected" : ""}`}
                                role="button"
                                tabIndex={0}
                                aria-label={`Manage ${title}`}
                                onClick={() => openManageForJob(job)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openManageForJob(job);
                                  }
                                }}
                              >
                                <label
                                  className="admin-menu-surface-checkbox-wrap"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    className="admin-menu-surface-checkbox"
                                    checked={isSelected}
                                    aria-label={`Select ${title}`}
                                    onChange={(e) => toggleSelection(job.id, e.target.checked)}
                                  />
                                </label>

                                <span className={`admin-menu-surface-status ${jobSurfaceStatusClass(job)}`}>
                                  {jobStatusLabel(job)}
                                </span>

                                <div className="admin-menu-surface-main">
                                  <span className="admin-menu-surface-name">{title}</span>
                                  <span className="admin-menu-surface-sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="admin-menu-surface-desc">{desc}</span>
                                  <span className="admin-menu-surface-sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="admin-menu-surface-meta">{stats}</span>
                                </div>

                                <div
                                  className="admin-menu-surface-actions"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <MenuEntityActionsMenu
                                    entityName={title}
                                    hideHeader
                                    open={openActionsId === `history:${job.id}`}
                                    actions={actions}
                                    onToggle={() =>
                                      setOpenActionsId((id) => (id === `history:${job.id}` ? null : `history:${job.id}`))
                                    }
                                    onAction={(actionId) => handleOperationAction(job, actionId)}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {historyPager.showPagination ? (
                        <MenuSurfacePagination
                          page={historyPager.page}
                          totalPages={historyPager.totalPages}
                          totalItems={historyPager.totalItems}
                          pageSize={historyPager.pageSize}
                          onPageChange={historyPager.goToPage}
                          label="History pagination"
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "templates" ? (
              <div className="admin-menu-tab-stack data-transfer-templates">
                <div className="admin-menu-surface-board data-transfer-templates-board">
                  <div className="admin-menu-surface-board-head">
                    <div className="min-w-0">
                      <h3 className="admin-menu-surface-board-title">Import templates</h3>
                      <p className="admin-menu-surface-board-desc">
                        Versioned CSV templates for this venue — create, edit, download, duplicate, or use in import.
                      </p>
                    </div>
                    <div className="admin-menu-surface-board-actions">
                      <AdminBtnPrimary type="button" disabled={!canEdit} onClick={openCreateTemplate}>
                        Create template
                      </AdminBtnPrimary>
                    </div>
                  </div>

                  {allTemplates.length > 0 ? (
                    <MenuListSearchField
                      value={templateSearchQuery}
                      onChange={setTemplateSearchQuery}
                      placeholder="Search templates by name, data type, or status…"
                      aria-label="Search import templates"
                      filterGroups={TRANSFER_TEMPLATE_LIST_QUERY.filterGroups}
                      sortOptions={TRANSFER_TEMPLATE_LIST_QUERY.sortOptions}
                      defaultSort={TRANSFER_TEMPLATE_LIST_QUERY.defaultSort}
                      activeFilters={templateFilters}
                      activeSort={templateSort}
                      totalCount={allTemplates.length}
                      resultCount={filteredTemplates.length}
                      onFiltersChange={setTemplateFilters}
                      onSortChange={setTemplateSort}
                      filterTitle="Filter templates"
                      filterSubtitle="Narrow by status, data type, and origin."
                      sortTitle="Sort templates"
                      sortSubtitle="Changes apply to the list instantly."
                    />
                  ) : null}

                  {allTemplates.length === 0 ? (
                    <AdminEmptyState>
                      No templates yet. Create one or refresh to load ServeOS defaults for this venue.
                    </AdminEmptyState>
                  ) : filteredTemplates.length === 0 ? (
                    <p className="admin-config-text-muted py-2 text-sm">No templates match your search or filters.</p>
                  ) : (
                    <>
                      <ul
                        className={`admin-menu-surface-list ${templatePager.pageClassName}`}
                        key={templatePager.pageKey}
                      >
                        {templatePager.pagedItems.map((row, index) => {
                          const actions = templateRowActions(row);
                          return (
                            <li
                              key={row.id}
                              className="admin-menu-surface-list-item"
                              style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                            >
                              <div
                                className="admin-menu-surface-card data-transfer-op-card"
                                role="button"
                                tabIndex={0}
                                aria-label={`Edit ${row.name}`}
                                onClick={() => openEditTemplate(row)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openEditTemplate(row);
                                  }
                                }}
                              >
                                <span className={`admin-menu-surface-status ${templateSurfaceStatusClass(row)}`}>
                                  {templateStatusLabel(row)}
                                </span>

                                <div className="admin-menu-surface-main">
                                  <span className="admin-menu-surface-name">{row.name}</span>
                                  <span className="admin-menu-surface-sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="admin-menu-surface-desc">{templateListDescription(row)}</span>
                                  <span className="admin-menu-surface-sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="admin-menu-surface-meta">{templateMetaLabel(row)}</span>
                                </div>

                                <div
                                  className="admin-menu-surface-actions"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <MenuEntityActionsMenu
                                    entityName={row.name}
                                    hideHeader
                                    open={openActionsId === `template:${row.id}`}
                                    actions={actions}
                                    onToggle={() =>
                                      setOpenActionsId((id) =>
                                        id === `template:${row.id}` ? null : `template:${row.id}`
                                      )
                                    }
                                    onAction={(actionId) => void handleTemplateAction(row, actionId)}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {templatePager.showPagination ? (
                        <MenuSurfacePagination
                          page={templatePager.page}
                          totalPages={templatePager.totalPages}
                          totalItems={templatePager.totalItems}
                          pageSize={templatePager.pageSize}
                          onPageChange={templatePager.goToPage}
                          label="Templates pagination"
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "migration" ? (
              <div className="admin-menu-tab-stack data-transfer-migration">
                <div className="admin-menu-surface-board data-transfer-migration-board">
                  <div className="admin-menu-surface-board-head">
                    <div className="min-w-0">
                      <div className="data-transfer-migration-title-inline">
                        <h3 className="admin-menu-surface-board-title">Migration</h3>
                        <button
                          type="button"
                          className="data-transfer-migration-help"
                          aria-label="Need help with migration?"
                          aria-haspopup="dialog"
                          onClick={() => setMigrationHelpChooserOpen(true)}
                        >
                          ?
                        </button>
                      </div>
                      <p className="admin-menu-surface-board-desc">
                        Move from another system while preserving external IDs — separate from everyday imports.
                      </p>
                    </div>
                  </div>

                  <div className="data-transfer-migration-panel" data-migration-action>
                    <div className="data-transfer-migration-panel-copy">
                      <p className="data-transfer-block-label">Source system</p>
                      <p className="data-transfer-migration-panel-desc">
                        Pick where you’re migrating from. Custom CSV works today; other providers can request assisted
                        migration until their connectors ship.
                      </p>
                    </div>

                    <div className="data-transfer-migration-controls">
                      <AdminBubbleDropdown
                        className="data-transfer-migration-provider"
                        label="Source system"
                        value={
                          migrationProviderOptions.some((o) => o.value === migrationProviderKey)
                            ? migrationProviderKey
                            : "custom-csv"
                        }
                        options={migrationProviderOptions}
                        bubbleArrow="end"
                        searchable
                        searchPlaceholder="Search systems…"
                        onChange={handleMigrationProviderChange}
                      />

                      <div className="data-transfer-migration-cta-row">
                        <AdminBtnPrimary type="button" disabled={!canEdit} onClick={startMigration}>
                          {selectedMigrationProvider?.availability === "available"
                            ? "Start migration"
                            : "Request assisted migration"}
                        </AdminBtnPrimary>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </AdminStaleContent>

      <ImportWizardModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        catalog={catalog}
        canEdit={canEdit}
        initialTarget={importTarget}
        onCompleted={() => void reload()}
      />
      <ExportWizardModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        catalog={catalog}
        initialTarget={exportTarget}
        onCompleted={() => void reload()}
      />
      <TransferOperationDetailsModal
        open={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        job={selectedJob}
        catalog={catalog}
        venueName={venueName}
        onDownloadExport={(job) => void redownloadExport(job)}
      />

      {token && restaurantId ? (
        <TransferTemplateFormModal
          open={templateFormOpen}
          mode={templateFormMode}
          token={token}
          restaurantId={restaurantId}
          catalog={catalog}
          template={editingTemplate}
          onClose={() => {
            setTemplateFormOpen(false);
            setEditingTemplate(null);
          }}
          onSaved={() => void reload()}
        />
      ) : null}

      <TransferManageDrawer
        open={manageOpen}
        jobs={tab === "history" ? filteredHistory : filteredOperations}
        selectedIds={selectedIds}
        catalog={catalog}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        canEdit={canEdit}
        onClose={() => setManageOpen(false)}
        onRefresh={() => void reload()}
        onClearSelection={() => setSelectedIds(new Set())}
        onViewJob={(job) => setSelectedJob(job)}
        onDownloadJob={(job) => {
          if (isUiOnlyTransferId(job.id)) {
            pushToast("Preview only — download will work with real exports.", "success");
            return;
          }
          void redownloadExport(job);
        }}
      />

      <MigrationHelpChooserModal
        open={migrationHelpChooserOpen}
        onClose={() => setMigrationHelpChooserOpen(false)}
        onChooseGuide={() => {
          setMigrationHelpChooserOpen(false);
          setMigrationGuideOpen(true);
        }}
        onChooseManual={() => {
          setMigrationHelpChooserOpen(false);
          openManualMigration(migrationProviderKey);
        }}
      />

      <MigrationGuideModal
        open={migrationGuideOpen}
        steps={catalog?.migrationSteps ?? []}
        onClose={() => setMigrationGuideOpen(false)}
      />

      <MenuPageModalShell
        open={manualMigrationOpen}
        onClose={() => {
          if (manualBusy) return;
          setManualMigrationOpen(false);
        }}
        title="Request manual migration"
        description="Ask ServeOS to help move data from your current system. We’ll review and follow up."
        titleId="data-transfer-manual-migration"
        maxWidthClass="max-w-md"
        busy={manualBusy}
      >
        <label className="block text-sm">
          <span className="admin-config-text-subtle">Current system (optional)</span>
          <textarea
            className="admin-config-input mt-1 w-full min-h-[6.5rem] resize-y"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="e.g. Square, Toast, Lightspeed — and what you need migrated"
            disabled={manualBusy}
          />
        </label>
        <ProfileModalNote>
          This does not change your live venue data. A specialist will contact you before anything is imported.
        </ProfileModalNote>
        <ProfileModalFooter
          cancelLabel="Cancel"
          onCancel={() => setManualMigrationOpen(false)}
          confirmLabel="Send request"
          busy={manualBusy}
          onConfirm={() => void submitManualMigrationRequest()}
        />
      </MenuPageModalShell>
    </AdminPanel>
  );
}
