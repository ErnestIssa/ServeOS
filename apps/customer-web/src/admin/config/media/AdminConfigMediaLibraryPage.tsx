import { useCallback, useEffect, useState } from "react";
import {
  listMediaLibrary,
  listMediaCollections,
  listMediaUploadJobs,
  type MediaCollectionRow,
  type MediaLibraryAsset,
  type MediaLibraryListQuery,
  type MediaUploadJobRow
} from "../../../api";
import { useMenuCapabilities } from "../useMenuCapabilities";
import { AdminBtnPrimary, AdminEmptyState, AdminSectionHeader } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { CONFIG_PRESET_DESCRIPTIONS } from "../configRouting";
import { MediaLibraryFilters } from "./MediaLibraryFilters";
import { MediaLibraryGrid } from "./MediaLibraryGrid";
import { MediaAssetDetailsDrawer } from "./MediaAssetDetailsDrawer";
import { MediaUploadFlowModal } from "./MediaUploadFlowModal";
import { MediaCollectionsPanel } from "./MediaCollectionsPanel";
import { MediaUploadQueuePanel } from "./MediaUploadQueuePanel";
import { MediaReviewStubPanel } from "./MediaReviewStubPanel";

type Section = "library" | "collections" | "queue" | "review";

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName?: string;
};

export function AdminConfigMediaLibraryPage({ token, restaurantId, venueName = "" }: Props) {
  const { pushToast } = useAdminToast();
  const [section, setSection] = useState<Section>("library");
  const [query, setQuery] = useState<MediaLibraryListQuery>({ page: 1, pageSize: 48 });
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [collections, setCollections] = useState<MediaCollectionRow[]>([]);
  const [jobs, setJobs] = useState<MediaUploadJobRow[]>([]);

  const caps = useMenuCapabilities(token, restaurantId);
  const canView = caps.can("media", "view");
  const canUpload = caps.can("media", "upload");
  const canEdit = caps.can("media", "edit");

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

  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  useEffect(() => {
    void reloadCollections();
    void reloadJobs();
  }, [reloadCollections, reloadJobs]);

  if (!token || !restaurantId) {
    return <AdminEmptyState>Select a venue to manage the Media Library.</AdminEmptyState>;
  }

  if (!canView) {
    return <AdminEmptyState>Your role cannot view the Media Library.</AdminEmptyState>;
  }

  return (
    <div className={"admin-menu-tab-stack space-y-4"}>
      <AdminSectionHeader
        title={"Media Library"}
        description={CONFIG_PRESET_DESCRIPTIONS["media-library"]}
      />

      <div className={"flex flex-wrap gap-2"}>
        {(
          [
            ["library", "Library"],
            ["collections", "Collections"],
            ["queue", "Upload queue"],
            ["review", "Review"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type={"button"}
            className={
              section === id
                ? "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                : "rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold admin-config-text"
            }
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
        <div className={"ml-auto flex flex-wrap gap-2"}>
          {canUpload ? (
            <AdminBtnPrimary onClick={() => setUploadOpen(true)}>Add media</AdminBtnPrimary>
          ) : null}
        </div>
      </div>

      {section === "library" ? (
        <>
          <MediaLibraryFilters
            query={query}
            collections={collections}
            onChange={setQuery}
            total={total}
          />
          <MediaLibraryGrid
            assets={assets}
            loading={loading}
            onOpen={(id) => setDetailsId(id)}
            venueName={venueName}
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
          }}
        />
      ) : null}

      {section === "queue" ? (
        <MediaUploadQueuePanel jobs={jobs} onRefresh={() => void reloadJobs()} />
      ) : null}

      {section === "review" ? <MediaReviewStubPanel /> : null}

      <MediaAssetDetailsDrawer
        token={token}
        restaurantId={restaurantId}
        assetId={detailsId}
        open={Boolean(detailsId)}
        canEdit={canEdit}
        canUpload={canUpload}
        onClose={() => setDetailsId(null)}
        onChanged={() => {
          void reloadLibrary();
          void reloadCollections();
        }}
      />

      <MediaUploadFlowModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        token={token}
        restaurantId={restaurantId}
        canUpload={canUpload}
        onDone={() => {
          void reloadLibrary();
          void reloadJobs();
        }}
      />
    </div>
  );
}
