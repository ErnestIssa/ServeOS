import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMediaCollectionItems,
  attachMediaLibraryAsset,
  getMediaLibraryAsset,
  patchMediaLibraryAsset,
  replaceMediaLibraryAsset,
  rollbackMediaLibraryAsset,
  type MediaLibraryAsset,
  type MediaLibraryDetail
} from "../../../api";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "../menu/menuPageModalShell";
import { useAdminToast } from "../../AdminToast";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { SkeletonBone } from "../../AdminSkeleton";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MediaUsageGraph } from "./MediaUsageGraph";
import { readFileAsDataUrl } from "./mediaLibraryUpload";
import { formatDetailsWhen, shortEntityId, DetailsInternalId } from "../menu/detailsDrawerUi";

export type MediaManageSection = "library" | "collections" | "queue" | "review" | "archived";

type WorkspaceTab =
  | "overview"
  | "preview"
  | "usage"
  | "replace"
  | "versions"
  | "permissions"
  | "metadata"
  | "health"
  | "activity";

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  assets: MediaLibraryAsset[];
  initialAssetId?: string | null;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenDetails: (assetId: string) => void;
  onRequestDelete: (assetId: string) => void;
  /** Kept for page section routing compatibility — unused in deep workspace. */
  onAddMedia?: () => void;
  onGoSection?: (section: MediaManageSection) => void;
};

const TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "preview", label: "Preview" },
  { id: "usage", label: "Usage" },
  { id: "replace", label: "Replace" },
  { id: "versions", label: "Versions" },
  { id: "permissions", label: "Permissions" },
  { id: "metadata", label: "Metadata" },
  { id: "health", label: "Health" },
  { id: "activity", label: "Activity" }
];

function MediaManageWorkspaceSkeleton() {
  return (
    <div className="admin-media-manage-center__skeleton" aria-busy aria-label="Loading asset">
      <div className="admin-media-manage-center__skeleton-tabs">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonBone key={i} className="h-7 w-16" rounded="full" />
        ))}
      </div>
      <div className="admin-media-manage-center__skeleton-body">
        <SkeletonBone className="h-4 w-28" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBone className="h-3 w-16" rounded="sm" />
              <SkeletonBone className="h-5 w-full max-w-[10rem]" />
            </div>
          ))}
        </div>
        <SkeletonBone className="mt-6 h-4 w-32" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBone className="h-3 w-20" rounded="sm" />
              <SkeletonBone className="h-5 w-full max-w-[9rem]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaManageDrawer({
  open,
  venueName,
  token,
  restaurantId,
  assets,
  initialAssetId = null,
  canUpload,
  canEdit,
  canDelete,
  onClose,
  onChanged,
  onOpenDetails,
  onRequestDelete
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [detail, setDetail] = useState<MediaLibraryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [pickerQ, setPickerQ] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) {
      setMounted(true);
      setActiveId((prev) => {
        const preferred = initialAssetId ?? prev;
        if (preferred && assets.some((a) => a.id === preferred)) return preferred;
        return assets[0]?.id ?? null;
      });
      setTab("overview");
      setHeaderMenuOpen(false);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    setHeaderMenuOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setDetail(null);
      closeTimerRef.current = null;
    }, 520);
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    // Intentionally only re-run on open / initialAssetId — not on every assets refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAssetId]);

  useEffect(() => {
    if (!open) return;
    setActiveId((prev) => {
      if (prev && assets.some((a) => a.id === prev)) return prev;
      return assets[0]?.id ?? null;
    });
  }, [open, assets]);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  const loadDetail = useCallback(async () => {
    if (!activeId || !open) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const requestId = activeId;
    setLoading(true);
    setDetail(null);
    const res = await getMediaLibraryAsset(token, restaurantId, activeId);
    if (requestId !== activeIdRef.current) return;
    setLoading(false);
    if (!res.ok || !res.asset) {
      pushToast(res.message ?? "Could not load asset.", "error");
      setDetail(null);
      return;
    }
    setDetail(res.asset);
    setTitle(res.asset.displayName || res.asset.originalName || "");
    setAlt(res.asset.altText || "");
  }, [activeId, open, token, restaurantId, pushToast]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const filteredAssets = assets.filter((a) => {
    const q = pickerQ.trim().toLowerCase();
    if (!q) return true;
    const name = (a.displayName || a.originalName || "").toLowerCase();
    return name.includes(q) || a.id.toLowerCase().includes(q);
  });

  const saveMeta = async () => {
    if (!detail || !canEdit) return;
    const savedTitle = detail.displayName || detail.originalName || "";
    const savedAlt = detail.altText || "";
    if (title.trim() === savedTitle.trim() && alt === savedAlt) return;
    setBusy(true);
    const res = await patchMediaLibraryAsset(token, restaurantId, detail.id, {
      displayName: title,
      altText: alt
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? "Could not save metadata.", "error");
      return;
    }
    pushToast("Metadata saved.", "success");
    onChanged();
    void loadDetail();
  };

  const onReplace = async (file: File) => {
    if (!detail || !canUpload) return;
    setBusy(true);
    const dataBase64 = await readFileAsDataUrl(file);
    const res = await replaceMediaLibraryAsset(token, restaurantId, detail.id, {
      dataBase64,
      contentType: file.type,
      note: "Replaced from Media Management Center"
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Replace failed.", "error");
      return;
    }
    pushToast(`Replaced everywhere — version ${res.versionNumber}.`, "success");
    onChanged();
    void loadDetail();
  };

  const archive = async (archived: boolean) => {
    if (!detail || !canEdit) return;
    setBusy(true);
    const res = await patchMediaLibraryAsset(token, restaurantId, detail.id, { archived });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? "Could not update archive state.", "error");
      return;
    }
    pushToast(archived ? "Asset archived." : "Asset restored.", "success");
    onChanged();
    void loadDetail();
  };

  const savedTitle = detail?.displayName || detail?.originalName || "";
  const savedAlt = detail?.altText || "";
  const metaDirty =
    Boolean(detail) && (title.trim() !== savedTitle.trim() || alt !== savedAlt);
  const canSaveMeta = canEdit && metaDirty && !busy;

  if (!mounted) return null;

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label="Close media management"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media Management Center"
        className={`admin-staff-profile-panel admin-menu-item-profile-panel admin-media-manage-center ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <h3 className="admin-staff-profile-title">Media Management Center</h3>
            <p className="admin-staff-profile-sub">
              Review files, update details, see where media is used, and replace or archive safely
              {venueName ? ` · ${venueName}` : ""}
              {detail ? ` · ${detail.displayName || detail.originalName || "Asset"}` : ""}
            </p>
          </div>
          <div className="admin-media-manage-center__header-actions">
            {activeId ? (
              <MenuEntityActionsMenu
                entityName={detail?.displayName || detail?.originalName || "Asset"}
                hideHeader
                open={headerMenuOpen}
                actions={[{ id: "details", label: "Details" }]}
                onToggle={() => setHeaderMenuOpen((v) => !v)}
                onAction={(id) => {
                  setHeaderMenuOpen(false);
                  if (id === "details" && activeId) onOpenDetails(activeId);
                }}
              />
            ) : null}
            <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="admin-media-manage-center__layout">
          <aside className="admin-media-manage-center__rail">
            <input
              type="search"
              className="admin-menu-surface-search"
              placeholder="Find asset…"
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              aria-label="Find asset to manage"
            />
            <ul className="admin-media-manage-center__asset-list">
              {filteredAssets.map((a) => {
                const name = a.displayName || a.originalName || "Untitled";
                const active = a.id === activeId;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`admin-media-manage-center__asset-btn${active ? " is-active" : ""}`}
                      onClick={() => {
                        setActiveId(a.id);
                        setTab("overview");
                        setHeaderMenuOpen(false);
                      }}
                    >
                      {a.url && a.contentType.startsWith("image/") ? (
                        <img src={a.url} alt="" className="admin-media-manage-center__thumb" />
                      ) : (
                        <span className="admin-media-manage-center__thumb admin-media-manage-center__thumb--empty">
                          {a.contentType.startsWith("video/") ? "Vid" : "File"}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-xs font-bold">{name}</span>
                        <span className="block truncate text-[0.65rem] admin-config-text-muted">
                          {a.usageCount} use{a.usageCount === 1 ? "" : "s"}
                          {a.archivedAt ? " · Archived" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="admin-media-manage-center__main">
            {!activeId ? (
              <div className="admin-media-manage-center__empty">
                <p className="font-display text-lg font-bold admin-config-text">No media yet</p>
                <p className="mt-1 text-sm admin-config-text-muted">
                  Upload a file from the library to manage it here.
                </p>
              </div>
            ) : loading || !detail ? (
              <MediaManageWorkspaceSkeleton />
            ) : (
              <>
                <nav className="admin-media-manage-center__tabs" aria-label="Management sections">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`admin-page-tab admin-media-manage-center__tab${tab === t.id ? " admin-page-tab--active" : ""}`}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>

                <div className="admin-media-manage-center__panel">
                  {tab === "overview" ? (
                    <section className="space-y-4">
                      <div>
                        <h4 className="admin-staff-drawer-section-title">Identity</h4>
                        <div className="admin-media-manage-center__asset-id">
                          <DetailsInternalId id={detail.id} label="Asset ID" />
                        </div>
                        <dl className="admin-media-manage-center__kv">
                          <div>
                            <dt>Created</dt>
                            <dd>{formatDetailsWhen(detail.createdAt)}</dd>
                          </div>
                          <div>
                            <dt>Uploaded by</dt>
                            <dd>{detail.createdByUserId ? shortEntityId(detail.createdByUserId) : "—"}</dd>
                          </div>
                          <div>
                            <dt>Restaurant</dt>
                            <dd>{venueName || restaurantId}</dd>
                          </div>
                          <div>
                            <dt>Collections</dt>
                            <dd>
                              {detail.collections?.length
                                ? detail.collections.map((c) => c.name).join(", ")
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              {detail.archivedAt
                                ? "Archived"
                                : detail.processingStatus === "PROCESSING"
                                  ? "Processing"
                                  : detail.processingStatus === "FAILED"
                                    ? "Failed"
                                    : "Active"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <h4 className="admin-staff-drawer-section-title">File information</h4>
                        <dl className="admin-media-manage-center__kv">
                          <div>
                            <dt>Filename</dt>
                            <dd>{detail.originalName || "—"}</dd>
                          </div>
                          <div>
                            <dt>Type</dt>
                            <dd>{detail.contentType}</dd>
                          </div>
                          <div>
                            <dt>Size</dt>
                            <dd>{formatBytes(detail.byteSize)}</dd>
                          </div>
                          <div>
                            <dt>Resolution</dt>
                            <dd>
                              {detail.width && detail.height ? `${detail.width}×${detail.height}` : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Duration</dt>
                            <dd>{detail.durationMs != null ? `${Math.round(detail.durationMs / 1000)}s` : "—"}</dd>
                          </div>
                          <div>
                            <dt>Import</dt>
                            <dd>{detail.importSource ? String(detail.importSource).replaceAll("_", " ") : "Device"}</dd>
                          </div>
                        </dl>
                      </div>
                    </section>
                  ) : null}

                  {tab === "preview" ? (
                    <section className="space-y-3">
                      {detail.url && detail.contentType.startsWith("image/") ? (
                        <img
                          src={detail.url}
                          alt={detail.altText || ""}
                          className="max-h-[22rem] w-full rounded-2xl object-contain bg-slate-100"
                        />
                      ) : (
                        <p className="text-sm admin-config-text-muted">No preview available for this file type.</p>
                      )}
                      <p className="text-xs admin-config-text-muted">
                        Renditions (original / square / thumb / hero / mobile) appear here as the processing
                        pipeline expands.
                      </p>
                    </section>
                  ) : null}

                  {tab === "usage" ? (
                    <section>
                      <h4 className="admin-staff-drawer-section-title">Usage graph</h4>
                      <MediaUsageGraph usages={detail.usages ?? []} />
                    </section>
                  ) : null}

                  {tab === "replace" ? (
                    <section className="space-y-3">
                      <p className="text-sm admin-config-text-muted">
                        Replace keeps the same MediaAsset ID and creates a new version so every usage updates
                        automatically.
                      </p>
                      <p className="text-xs font-semibold admin-config-text">
                        Current: {detail.originalName || detail.displayName || "file"}
                      </p>
                      <input
                        ref={replaceInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void onReplace(f);
                        }}
                      />
                      <AdminBtnPrimary
                        disabled={!canUpload || busy}
                        onClick={() => replaceInputRef.current?.click()}
                      >
                        {busy ? "Replacing…" : "Replace everywhere"}
                      </AdminBtnPrimary>
                      <p className="text-xs admin-config-text-muted">
                        Replace only selected usages / create new asset instead — coming in a later governance
                        pass.
                      </p>
                    </section>
                  ) : null}

                  {tab === "versions" ? (
                    <section className="space-y-2">
                      {(detail.versions ?? []).length === 0 ? (
                        <p className="text-sm admin-config-text-muted">No version history yet.</p>
                      ) : (
                        (detail.versions ?? []).map((v) => (
                          <div key={v.id} className="admin-media-manage-center__version-row">
                            <div>
                              <p className="text-sm font-bold admin-config-text">
                                Version {v.versionNumber}
                                {v.versionNumber === detail.currentVersionNumber ? " · Current" : ""}
                              </p>
                              <p className="text-xs admin-config-text-muted">
                                {formatDetailsWhen(v.createdAt)}
                                {v.note ? ` · ${v.note}` : ""}
                              </p>
                            </div>
                            {canEdit && v.versionNumber !== detail.currentVersionNumber ? (
                              <AdminBtnSecondary
                                disabled={busy}
                                onClick={() =>
                                  void (async () => {
                                    setBusy(true);
                                    const res = await rollbackMediaLibraryAsset(
                                      token,
                                      restaurantId,
                                      detail.id,
                                      v.versionNumber
                                    );
                                    setBusy(false);
                                    if (!res.ok) {
                                      pushToast(res.message ?? "Rollback failed.", "error");
                                      return;
                                    }
                                    pushToast(`Restored version ${v.versionNumber}.`, "success");
                                    onChanged();
                                    void loadDetail();
                                  })()
                                }
                              >
                                Restore
                              </AdminBtnSecondary>
                            ) : null}
                          </div>
                        ))
                      )}
                    </section>
                  ) : null}

                  {tab === "permissions" ? (
                    <section className="space-y-2">
                      <p className="text-sm admin-config-text-muted">
                        Fine-grained per-asset permissions (`media.share`, approval workflows) land with the
                        Media Governance Layer. Today roles use venue media capabilities:
                      </p>
                      <ul className="text-sm admin-config-text space-y-1">
                        <li>✓ View — {canEdit || canUpload || canDelete ? "yes" : "limited"}</li>
                        <li>{canEdit ? "✓" : "–"} Attach / edit metadata</li>
                        <li>{canUpload ? "✓" : "–"} Replace / upload</li>
                        <li>{canDelete ? "✓" : "–"} Delete</li>
                      </ul>
                    </section>
                  ) : null}

                  {tab === "metadata" ? (
                    <section className="admin-media-manage-meta">
                      <header className="admin-media-manage-meta__intro">
                        <h4 className="admin-staff-drawer-section-title">File details</h4>
                        <p className="admin-media-manage-meta__lede">
                          Set the display title guests and staff see, plus alt text for accessibility.
                        </p>
                      </header>

                      <div className="admin-media-manage-meta__fields">
                        <label className="admin-media-manage-meta__field">
                          <span className="admin-media-manage-meta__label">Title</span>
                          <span className="admin-media-manage-meta__hint">Shown in the library and attach pickers</span>
                          <input
                            className="admin-config-input admin-media-manage-meta__input"
                            value={title}
                            disabled={!canEdit || busy}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Lunch special hero"
                          />
                        </label>
                        <label className="admin-media-manage-meta__field">
                          <span className="admin-media-manage-meta__label">Alt text</span>
                          <span className="admin-media-manage-meta__hint">
                            Describes the image for screen readers and public menus
                          </span>
                          <textarea
                            className="admin-config-input admin-media-manage-meta__input admin-media-manage-meta__textarea"
                            value={alt}
                            disabled={!canEdit || busy}
                            onChange={(e) => setAlt(e.target.value)}
                            placeholder="Short description of what’s in the image"
                            rows={3}
                          />
                        </label>
                      </div>

                      <p className="admin-media-manage-meta__note">
                        Tags, captions, allergen labels, and AI-assisted metadata will arrive later. Only
                        fields that work today are shown here.
                      </p>

                      {canEdit ? (
                        <div className="admin-media-manage-meta__actions">
                          <button
                            type="button"
                            className={`media-details-meta__save${canSaveMeta ? " is-ready" : ""}`}
                            disabled={!canSaveMeta}
                            onClick={() => void saveMeta()}
                          >
                            {busy && metaDirty ? "Saving…" : "Save metadata"}
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {tab === "health" ? (
                    <section
                      className={`media-details-health${
                        [
                          !detail.health?.missingAlt,
                          !detail.health?.unused,
                          !detail.health?.largeFile,
                          !detail.health?.processingFailed,
                          detail.health?.hasThumb !== false,
                          detail.health?.hasWebp !== false
                        ].every(Boolean)
                          ? " is-ready"
                          : " has-warnings"
                      }`}
                    >
                      <p className="media-details-health__status">
                        {[
                          !detail.health?.missingAlt,
                          !detail.health?.unused,
                          !detail.health?.largeFile,
                          !detail.health?.processingFailed,
                          detail.health?.hasThumb !== false,
                          detail.health?.hasWebp !== false
                        ].every(Boolean)
                          ? "Healthy"
                          : "Needs attention"}
                      </p>
                      <ul className="media-details-health__checks" aria-label="Health checks">
                        {(
                          [
                            { id: "alt", label: "Alt text present", ok: !detail.health?.missingAlt },
                            { id: "used", label: "Used somewhere", ok: !detail.health?.unused },
                            { id: "size", label: "Reasonable file size", ok: !detail.health?.largeFile },
                            {
                              id: "pipeline",
                              label: "Processing OK",
                              ok: !detail.health?.processingFailed
                            },
                            {
                              id: "thumb",
                              label: "Has thumbnail",
                              ok: detail.health?.hasThumb !== false
                            },
                            { id: "webp", label: "Has WebP", ok: detail.health?.hasWebp !== false }
                          ] as const
                        ).map((check) => (
                          <li
                            key={check.id}
                            className={`media-details-health__check${check.ok ? " is-ok" : " is-fail"}`}
                          >
                            <span
                              className="media-details-health__box"
                              aria-hidden
                              data-checked={check.ok ? "true" : "false"}
                            >
                              {check.ok ? (
                                <svg viewBox="0 0 16 16" className="media-details-health__tick" aria-hidden>
                                  <path
                                    d="M3.5 8.2l2.8 2.8 6.2-6.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : null}
                            </span>
                            <span className="media-details-health__label">{check.label}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {tab === "activity" ? (
                    <section>
                      <p className="text-sm admin-config-text-muted">
                        Activity log (who uploaded, attached, replaced) requires the Media Governance Layer —
                        not inventing events here.
                      </p>
                      <p className="mt-3 text-xs admin-config-text-muted">
                        Created {formatDetailsWhen(detail.createdAt)} · Updated{" "}
                        {formatDetailsWhen(detail.updatedAt)}
                      </p>
                    </section>
                  ) : null}
                </div>

                <section className="admin-media-manage-center__danger" aria-label="Danger zone">
                  <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">
                    Danger zone
                  </h4>
                  <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous media actions">
                    {canEdit ? (
                      <button
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        disabled={busy}
                        onClick={() => void archive(!detail.archivedAt)}
                      >
                        <span className="admin-menu-manage-danger-btn-label">
                          {detail.archivedAt ? "Restore from archive" : "Archive asset"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">
                          Soft removal — existing orders keep working.
                        </span>
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        onClick={() => onRequestDelete(detail.id)}
                      >
                        <span className="admin-menu-manage-danger-btn-label">Delete permanently…</span>
                        <span className="admin-menu-manage-danger-btn-desc">
                          Opens safety checks for usages before hard delete.
                        </span>
                      </button>
                    ) : null}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Re-export attach helper for page-level venue attach from quick menu. */
export async function attachVenueMedia(
  token: string,
  restaurantId: string,
  assetId: string,
  targetType: "VENUE_LOGO" | "VENUE_COVER"
) {
  return attachMediaLibraryAsset(token, restaurantId, assetId, {
    targetType,
    targetId: restaurantId,
    role: targetType === "VENUE_COVER" ? "COVER" : "PRIMARY"
  });
}

export async function moveAssetToCollection(
  token: string,
  restaurantId: string,
  collectionId: string,
  assetId: string
) {
  return addMediaCollectionItems(token, restaurantId, collectionId, [assetId]);
}
