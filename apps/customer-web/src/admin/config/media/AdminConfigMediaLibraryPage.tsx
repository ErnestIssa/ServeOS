import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getMediaLibraryStats,
  listMediaLibrary,
  listMediaCollections,
  listMediaUploadJobs,
  patchMediaLibraryAsset,
  replaceMediaLibraryAsset,
  type MediaCollectionRow,
  type MediaLibraryAsset,
  type MediaLibraryListQuery,
  type MediaLibraryStats,
  type MediaUploadJobRow
} from "../../../api";
import { useMenuCapabilities } from "../useMenuCapabilities";
import { AdminEmptyState, AdminPanel, AdminSectionHeader } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { CONFIG_PRESET_DESCRIPTIONS } from "../configRouting";
import { MenuToolbarButton } from "../menu/MenuPageUi";
import { MEDIA_DEFAULT_SORT } from "./mediaListQuery";
import { MediaLibraryFilters } from "./MediaLibraryFilters";
import { MediaLibraryGrid } from "./MediaLibraryGrid";
import { MediaAssetDetailsDrawer } from "./MediaAssetDetailsDrawer";
import { MediaUploadFlowModal } from "./MediaUploadFlowModal";
import { MediaCollectionsPanel } from "./MediaCollectionsPanel";
import { MediaUploadQueuePanel } from "./MediaUploadQueuePanel";
import { MediaReviewStubPanel } from "./MediaReviewStubPanel";
import { MediaArchivedPanel } from "./MediaArchivedPanel";
import { MediaLibraryDashboard } from "./MediaLibraryDashboard";
import {
  attachVenueMedia,
  MediaManageDrawer,
  moveAssetToCollection,
  type MediaManageSection
} from "./MediaManageDrawer";
import { MediaDeleteSafetyModal } from "./MediaDeleteSafetyModal";
import { MediaAttachQuickModal } from "./MediaAttachQuickModal";
import { MediaMoveToCollectionModal } from "./MediaMoveToCollectionModal";
import type { MediaCardActionId } from "./mediaCardActions";
import { readFileAsDataUrl, uploadLibraryMediaFile } from "./mediaLibraryUpload";
import { buildNavHref, syncAdminNavHash } from "../../adminWorkspaceRouting";

type Section = MediaManageSection;

const SECTION_COPY: Record<Section, { title: string; description: string }> = {
  library: {
    title: "Library",
    description: "⋮ for quick actions · Manage for the deep Media Management Center."
  },
  collections: {
    title: "Collections",
    description: "Organize assets into reusable collections."
  },
  queue: {
    title: "Upload queue",
    description: "Track uploads through the processing pipeline."
  },
  review: {
    title: "Review",
    description: "Manager review workflow for media approvals."
  },
  archived: {
    title: "Archived",
    description: "Soft-removed assets — restore, replace, or delete permanently."
  }
};

const SECTION_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName?: string;
};

export function AdminConfigMediaLibraryPage({ token, restaurantId, venueName = "" }: Props) {
  const { pushToast } = useAdminToast();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<Section>("library");
  const [query, setQuery] = useState<MediaLibraryListQuery>({
    page: 1,
    pageSize: 48,
    sort: MEDIA_DEFAULT_SORT
  });
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [archivedAssets, setArchivedAssets] = useState<MediaLibraryAsset[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageAssetId, setManageAssetId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [attachAsset, setAttachAsset] = useState<MediaLibraryAsset | null>(null);
  const [moveAsset, setMoveAsset] = useState<MediaLibraryAsset | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [collections, setCollections] = useState<MediaCollectionRow[]>([]);
  const [jobs, setJobs] = useState<MediaUploadJobRow[]>([]);
  const [stats, setStats] = useState<MediaLibraryStats | null>(null);

  const caps = useMenuCapabilities(token, restaurantId);
  const canView = caps.can("media", "view");
  const canUpload = caps.can("media", "upload");
  const canEdit = caps.can("media", "edit");
  const canDelete = caps.can("media", "delete");

  const cardCaps = useMemo(
    () => ({
      canView,
      canEdit,
      canUpload,
      canDelete,
      canShare: canView
    }),
    [canView, canEdit, canUpload, canDelete]
  );

  const reloadLibrary = useCallback(async () => {
    if (!token || !restaurantId || !canView) return;
    setLoading(true);
    const res = await listMediaLibrary(token, restaurantId, query);
    setLoading(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not load media library.", "error");
      return;
    }
    setAssets(res.assets ?? []);
    setTotal(res.total ?? 0);
  }, [token, restaurantId, canView, query, pushToast]);

  const reloadArchived = useCallback(async () => {
    if (!token || !restaurantId || !canView) return;
    setArchivedLoading(true);
    const res = await listMediaLibrary(token, restaurantId, {
      page: 1,
      pageSize: 96,
      archived: true,
      sort: MEDIA_DEFAULT_SORT
    });
    setArchivedLoading(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not load archived media.", "error");
      return;
    }
    setArchivedAssets(res.assets ?? []);
  }, [token, restaurantId, canView, pushToast]);

  const reloadStats = useCallback(async () => {
    if (!token || !restaurantId || !canView) return;
    const res = await getMediaLibraryStats(token, restaurantId);
    if (res.ok && res.stats) setStats(res.stats);
  }, [token, restaurantId, canView]);

  const reloadCollections = useCallback(async () => {
    if (!token || !restaurantId || !canView) return;
    const res = await listMediaCollections(token, restaurantId);
    if (res.ok) setCollections(res.collections ?? []);
  }, [token, restaurantId, canView]);

  const reloadJobs = useCallback(async () => {
    if (!token || !restaurantId || !canView) return;
    const res = await listMediaUploadJobs(token, restaurantId);
    if (res.ok) setJobs(res.jobs ?? []);
  }, [token, restaurantId, canView]);

  const refreshAll = useCallback(() => {
    void reloadLibrary();
    void reloadArchived();
    void reloadCollections();
    void reloadStats();
  }, [reloadLibrary, reloadArchived, reloadCollections, reloadStats]);

  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  useEffect(() => {
    if (section === "archived") void reloadArchived();
  }, [section, reloadArchived]);

  useEffect(() => {
    void reloadCollections();
    void reloadJobs();
    void reloadStats();
  }, [reloadCollections, reloadJobs, reloadStats]);

  const handleCardAction = async (asset: MediaLibraryAsset, actionId: MediaCardActionId) => {
    if (!token || !restaurantId) return;

    if (actionId === "open_manage") {
      setManageAssetId(asset.id);
      setManageOpen(true);
      return;
    }
    if (actionId === "attach") {
      setAttachAsset(asset);
      return;
    }
    if (actionId === "replace") {
      setReplaceTargetId(asset.id);
      window.setTimeout(() => replaceInputRef.current?.click(), 0);
      return;
    }
    if (actionId === "create_variant") {
      pushToast("Create variant will ship with the next rendition tools.", "success");
      return;
    }
    if (actionId === "duplicate") {
      if (!asset.url || !canUpload) {
        pushToast("Cannot duplicate this asset right now.", "error");
        return;
      }
      try {
        const res = await fetch(asset.url);
        const blob = await res.blob();
        const file = new File([blob], asset.originalName || asset.displayName || "copy.bin", {
          type: asset.contentType || blob.type
        });
        const uploaded = await uploadLibraryMediaFile(token, {
          restaurantId,
          file,
          kind: file.type.startsWith("video/") ? "video" : "image",
          displayName: `${(asset.displayName || asset.originalName || "Asset").replace(/\.[^.]+$/, "")} copy`,
          forceNewAsset: true,
          importMeta: { importSource: "DEVICE" }
        });
        if (!uploaded.ok) {
          pushToast(uploaded.error ?? "Duplicate failed.", "error");
          return;
        }
        pushToast("Duplicated as a new independent asset.", "success");
        refreshAll();
      } catch {
        pushToast("Duplicate failed.", "error");
      }
      return;
    }
    if (actionId === "move_collection") {
      setMoveAsset(asset);
      return;
    }
    if (actionId === "copy_link") {
      if (!asset.url) {
        pushToast("No URL available.", "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(asset.url);
        pushToast("Link copied.", "success");
      } catch {
        pushToast("Could not copy link.", "error");
      }
      return;
    }
    if (actionId === "download") {
      if (!asset.url) {
        pushToast("No file URL to download.", "error");
        return;
      }
      const a = document.createElement("a");
      a.href = asset.url;
      a.download = asset.originalName || asset.displayName || "media";
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
      return;
    }
    if (actionId === "archive" || actionId === "unarchive") {
      const res = await patchMediaLibraryAsset(token, restaurantId, asset.id, {
        archived: actionId === "archive"
      });
      if (!res.ok) {
        pushToast(res.message ?? "Could not update archive state.", "error");
        return;
      }
      pushToast(actionId === "archive" ? "Asset archived." : "Asset restored.", "success");
      refreshAll();
      return;
    }
    if (actionId === "delete") {
      setDeleteId(asset.id);
    }
  };

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-media-library-page">
        <AdminSectionHeader
          eyebrowText="Configuration"
          title="Media Library"
          description={CONFIG_PRESET_DESCRIPTIONS["media-library"]}
        />
        <AdminEmptyState>Select a venue to manage the Media Library.</AdminEmptyState>
      </AdminPanel>
    );
  }

  if (!canView) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-media-library-page">
        <AdminSectionHeader
          eyebrowText="Configuration"
          title="Media Library"
          description={CONFIG_PRESET_DESCRIPTIONS["media-library"]}
        />
        <AdminEmptyState>Your role cannot view the Media Library.</AdminEmptyState>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-media-library-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="Media Library"
        description={CONFIG_PRESET_DESCRIPTIONS["media-library"]}
      />

      <div className="mt-8">
        <MediaLibraryDashboard stats={stats} />
      </div>

      <div className="admin-menu-surface-board mt-5">
        <div className="admin-menu-surface-board-head">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`head-${section}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SECTION_TRANSITION}
              >
                <h3 className="admin-menu-surface-board-title">{SECTION_COPY[section].title}</h3>
                <p className="admin-menu-surface-board-desc">{SECTION_COPY[section].description}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="admin-menu-surface-board-actions">
            <MenuToolbarButton
              onClick={() => {
                setManageAssetId(null);
                setManageOpen(true);
              }}
            >
              Manage
            </MenuToolbarButton>
            {canUpload ? (
              <MenuToolbarButton primary onClick={() => setUploadOpen(true)}>
                Add media
              </MenuToolbarButton>
            ) : null}
          </div>
        </div>

        <div
          className="admin-config-tabs admin-menu-tabs flex gap-2 overflow-x-auto pb-3"
          role="tablist"
          aria-label="Media library sections"
        >
          {(
            [
              ["library", "Library"],
              ["collections", "Collections"],
              ["queue", "Upload queue"],
              ["review", "Review"],
              ["archived", "Archived"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              className={`admin-page-tab shrink-0 ${section === id ? "admin-page-tab--active" : ""}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            className="admin-menu-tab-panel admin-menu-tab-panel--bare"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SECTION_TRANSITION}
          >
            {section === "library" ? (
              <>
                <MediaLibraryFilters
                  query={query}
                  collections={collections}
                  total={total}
                  onChange={setQuery}
                />
                <MediaLibraryGrid
                  assets={assets}
                  loading={loading}
                  venueName={venueName}
                  caps={cardCaps}
                  onOpen={(id) => setDetailsId(id)}
                  onAction={(asset, actionId) => void handleCardAction(asset, actionId)}
                />
              </>
            ) : null}

            {section === "collections" ? (
              <MediaCollectionsPanel
                token={token}
                restaurantId={restaurantId}
                collections={collections}
                assets={assets}
                canEdit={canEdit}
                onRefresh={async () => {
                  await reloadCollections();
                  await reloadLibrary();
                  await reloadStats();
                }}
              />
            ) : null}

            {section === "queue" ? (
              <MediaUploadQueuePanel jobs={jobs} onRefresh={() => void reloadJobs()} />
            ) : null}

            {section === "review" ? <MediaReviewStubPanel /> : null}

            {section === "archived" ? (
              <MediaArchivedPanel
                assets={archivedAssets}
                loading={archivedLoading}
                venueName={venueName}
                caps={cardCaps}
                onOpen={(id) => setDetailsId(id)}
                onAction={(asset, actionId) => void handleCardAction(asset, actionId)}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const assetId = replaceTargetId;
          e.target.value = "";
          setReplaceTargetId(null);
          if (!file || !assetId || !token || !restaurantId) return;
          void (async () => {
            const dataBase64 = await readFileAsDataUrl(file);
            const res = await replaceMediaLibraryAsset(token, restaurantId, assetId, {
              dataBase64,
              contentType: file.type,
              note: "Replaced from library quick action"
            });
            if (!res.ok) {
              pushToast(res.message ?? res.error ?? "Replace failed.", "error");
              return;
            }
            pushToast(`Replaced — version ${res.versionNumber}. Same asset ID, all usages updated.`, "success");
            refreshAll();
          })();
        }}
      />

      <MediaAssetDetailsDrawer
        token={token}
        restaurantId={restaurantId}
        assetId={detailsId}
        open={Boolean(detailsId)}
        canEdit={canEdit}
        canUpload={canUpload}
        canDelete={canDelete}
        onClose={() => setDetailsId(null)}
        onChanged={refreshAll}
      />

      <MediaUploadFlowModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        token={token}
        restaurantId={restaurantId}
        canUpload={canUpload}
        onReuseExisting={(assetId) => {
          setSection("library");
          setDetailsId(assetId);
        }}
        onDone={() => {
          void reloadLibrary();
          void reloadJobs();
          void reloadStats();
        }}
      />

      <MediaManageDrawer
        open={manageOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        assets={section === "archived" ? archivedAssets : assets}
        initialAssetId={manageAssetId}
        canUpload={canUpload}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => {
          setManageOpen(false);
          setManageAssetId(null);
        }}
        onChanged={refreshAll}
        onOpenDetails={(id) => {
          setManageOpen(false);
          setDetailsId(id);
        }}
        onRequestDelete={(id) => {
          setManageOpen(false);
          setDeleteId(id);
        }}
        onAddMedia={() => setUploadOpen(true)}
        onGoSection={setSection}
      />

      {deleteId ? (
        <MediaDeleteSafetyModal
          open={Boolean(deleteId)}
          onClose={() => setDeleteId(null)}
          token={token}
          restaurantId={restaurantId}
          assetId={deleteId}
          assetName={(() => {
            const a =
              assets.find((x) => x.id === deleteId) ||
              archivedAssets.find((x) => x.id === deleteId);
            return a?.displayName || a?.originalName || undefined;
          })()}
          canDelete={canDelete}
          canEdit={canEdit}
          canUpload={canUpload}
          onReplaceEverywhere={() => {
            setReplaceTargetId(deleteId);
            setDeleteId(null);
            window.setTimeout(() => replaceInputRef.current?.click(), 0);
          }}
          onDone={() => {
            setDeleteId(null);
            refreshAll();
          }}
        />
      ) : null}

      {attachAsset ? (
        <MediaAttachQuickModal
          open={Boolean(attachAsset)}
          assetName={attachAsset.displayName || attachAsset.originalName || "Asset"}
          canEdit={canEdit}
          onClose={() => setAttachAsset(null)}
          onAttachVenue={(role) => {
            void (async () => {
              const res = await attachVenueMedia(token, restaurantId, attachAsset.id, role);
              if (!res.ok) {
                pushToast(res.message ?? res.error ?? "Attach failed.", "error");
                return;
              }
              pushToast(role === "VENUE_LOGO" ? "Attached as venue logo." : "Attached as venue cover.", "success");
              setAttachAsset(null);
              refreshAll();
            })();
          }}
          onPickDeferred={(target) => {
            setAttachAsset(null);
            if (target === "MENU_COVER" || target === "MENU_ITEM" || target === "CATEGORY") {
              syncAdminNavHash(buildNavHref("config", "menu"));
              pushToast("Open a menu entity and use Choose from library to finish attach.", "success");
              return;
            }
            pushToast("That attach target is not available in this workspace yet.", "error");
          }}
        />
      ) : null}

      {moveAsset ? (
        <MediaMoveToCollectionModal
          open={Boolean(moveAsset)}
          collections={collections}
          assetName={moveAsset.displayName || moveAsset.originalName || "Asset"}
          currentCollectionIds={moveAsset.collectionIds ?? []}
          onClose={() => setMoveAsset(null)}
          onPick={(collectionId) => {
            void (async () => {
              const res = await moveAssetToCollection(token, restaurantId, collectionId, moveAsset.id);
              if (!res.ok) {
                pushToast(res.message ?? res.error ?? "Could not move to collection.", "error");
                return;
              }
              pushToast("Moved to collection.", "success");
              setMoveAsset(null);
              refreshAll();
            })();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}
