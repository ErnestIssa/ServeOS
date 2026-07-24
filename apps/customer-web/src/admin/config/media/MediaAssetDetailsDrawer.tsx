import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMediaLibraryAsset,
  patchMediaLibraryAsset,
  replaceMediaLibraryAsset,
  rollbackMediaLibraryAsset,
  type MediaLibraryDetail
} from "../../../api";
import {
  DetailsDrawerShell,
  DetailsFlags,
  DetailsGrid,
  DetailsHealth,
  DetailsRow,
  DetailsSection,
  DetailsSystemStatus,
  formatDetailsWhen,
  shortEntityId
} from "../menu/detailsDrawerUi";
import { useAdminToast } from "../../AdminToast";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { readFileAsDataUrl } from "./mediaLibraryUpload";
import { MediaUsageGraph } from "./MediaUsageGraph";
import { MediaDeleteSafetyModal } from "./MediaDeleteSafetyModal";

type Props = {
  token: string;
  restaurantId: string;
  assetId: string | null;
  open: boolean;
  canEdit: boolean;
  canUpload: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaAssetDetailsDrawer({
  token,
  restaurantId,
  assetId,
  open,
  canEdit,
  canUpload,
  canDelete = false,
  onClose,
  onChanged
}: Props) {
  const { pushToast } = useAdminToast();
  const [asset, setAsset] = useState<MediaLibraryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [alt, setAlt] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!assetId || !open) return;
    const res = await getMediaLibraryAsset(token, restaurantId, assetId);
    if (!res.ok || !res.asset) {
      pushToast(res.message ?? "Could not load asset.", "error");
      return;
    }
    setAsset(res.asset);
    setName(res.asset.displayName || res.asset.originalName || "");
    setAlt(res.asset.altText || "");
  }, [assetId, open, token, restaurantId, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const warnings = [
    asset?.health?.missingAlt ? "Missing alt text" : null,
    asset?.health?.unused ? "Not used anywhere" : null,
    asset?.health?.largeFile ? "Large file" : null,
    asset?.health?.processingFailed ? "Processing failed" : null,
    asset?.health && asset.health.hasThumb === false ? "Missing thumbnail" : null,
    asset?.health && asset.health.hasWebp === false ? "Missing WebP" : null
  ].filter(Boolean) as string[];

  const saveMeta = async () => {
    if (!asset || !canEdit) return;
    setBusy(true);
    const res = await patchMediaLibraryAsset(token, restaurantId, asset.id, {
      displayName: name,
      altText: alt
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? "Could not save.", "error");
      return;
    }
    pushToast("Asset updated.", "success");
    onChanged();
    void load();
  };

  const toggleFavorite = async () => {
    if (!asset || !canEdit) return;
    await patchMediaLibraryAsset(token, restaurantId, asset.id, { favorite: !asset.favorite });
    onChanged();
    void load();
  };

  const onReplace = async (file: File) => {
    if (!asset || !canUpload) return;
    setBusy(true);
    const dataBase64 = await readFileAsDataUrl(file);
    const res = await replaceMediaLibraryAsset(token, restaurantId, asset.id, {
      dataBase64,
      contentType: file.type,
      note: "Replaced from library"
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Replace failed.", "error");
      return;
    }
    pushToast(`Replaced — version ${res.versionNumber}.`, "success");
    onChanged();
    void load();
  };

  const onRollback = async (versionNumber: number) => {
    if (!asset || !canEdit) return;
    setBusy(true);
    const res = await rollbackMediaLibraryAsset(token, restaurantId, asset.id, versionNumber);
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? "Rollback failed.", "error");
      return;
    }
    pushToast(`Rolled back to v${versionNumber}.`, "success");
    onChanged();
    void load();
  };

  return (
    <>
    <DetailsDrawerShell
      open={open}
      entityKey={asset?.id ?? assetId}
      title={asset?.displayName || asset?.originalName || "Asset"}
      subtitle="Media Library · read / manage"
      closeLabel="Close asset details"
      onClose={onClose}
    >
      {asset ? (
        <>
          {asset.url && asset.contentType.startsWith("image/") ? (
            <img
              src={asset.url}
              alt={asset.altText || asset.displayName || ""}
              className="mb-2 max-h-48 w-full rounded-xl object-cover"
            />
          ) : null}

          <DetailsSection title="Identity">
            <DetailsGrid>
              <DetailsRow label="Name" value={asset.displayName || asset.originalName || "—"} />
              <DetailsRow label="Internal ID" value={shortEntityId(asset.id)} />
              <DetailsRow label="Type" value={asset.contentType} />
              <DetailsRow label="Size" value={formatBytes(asset.byteSize)} />
              <DetailsRow
                label="Resolution"
                value={asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
              />
              <DetailsRow label="Created" value={formatDetailsWhen(asset.createdAt)} />
              <DetailsRow label="Updated" value={formatDetailsWhen(asset.updatedAt)} />
            </DetailsGrid>
          </DetailsSection>

          {canEdit ? (
            <DetailsSection title="Metadata">
              <div className="space-y-2">
                <label className="block text-xs font-bold admin-config-text-muted">
                  Display name
                  <input
                    className="admin-config-input mt-1 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-bold admin-config-text-muted">
                  Alt text
                  <input
                    className="admin-config-input mt-1 w-full"
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                  />
                </label>
                <AdminBtnPrimary disabled={busy} onClick={() => void saveMeta()}>
                  Save metadata
                </AdminBtnPrimary>
              </div>
            </DetailsSection>
          ) : null}

          <DetailsSection
            title="Where used"
            hint="Click a name to open that menu, item, category, or venue surface."
          >
            <MediaUsageGraph usages={asset.usages ?? []} />
          </DetailsSection>

          <DetailsSection title="Versions">
            <DetailsGrid>
              <DetailsRow label="Current" value={`v${asset.currentVersionNumber ?? 1}`} />
            </DetailsGrid>
            <ul className="admin-menu-details-health-list mt-3">
              {(asset.versions ?? []).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    Version {v.versionNumber}
                    {v.note ? ` · ${v.note}` : ""} · {formatDetailsWhen(v.createdAt)}
                  </span>
                  {canEdit && v.versionNumber !== asset.currentVersionNumber ? (
                    <button
                      type="button"
                      className="text-xs font-bold underline"
                      disabled={busy}
                      onClick={() => void onRollback(v.versionNumber)}
                    >
                      Rollback
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canUpload ? (
              <label className="mt-3 inline-flex cursor-pointer">
                <span className="sr-only">Replace asset</span>
                <AdminBtnSecondary disabled={busy}>Replace file</AdminBtnSecondary>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onReplace(f);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </DetailsSection>

          <DetailsSection title="Storage">
            <DetailsGrid>
              <DetailsRow label="Object key" value={shortEntityId(asset.objectKey)} />
              <DetailsRow label="Original key" value={shortEntityId(asset.originalObjectKey ?? asset.objectKey)} />
              <DetailsRow label="Visibility" value={asset.visibility ?? "PRIVATE"} />
              <DetailsRow label="Processing" value={asset.processingStatus ?? "READY"} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <>
                <AdminBtnSecondary disabled={busy} onClick={() => void toggleFavorite()}>
                  {asset.favorite ? "Unfavorite" : "Favorite"}
                </AdminBtnSecondary>
                {asset.archivedAt ? (
                  <AdminBtnSecondary
                    disabled={busy}
                    onClick={() =>
                      void patchMediaLibraryAsset(token, restaurantId, asset.id, {
                        archived: false
                      }).then(() => {
                        onChanged();
                        void load();
                      })
                    }
                  >
                    Unarchive
                  </AdminBtnSecondary>
                ) : (
                  <AdminBtnSecondary disabled={busy} onClick={() => setRemoveOpen(true)}>
                    Remove…
                  </AdminBtnSecondary>
                )}
              </>
            ) : null}
          </div>

          <DetailsSystemStatus
            rows={[
              {
                label: "CDN / signed URL",
                ok: Boolean(asset.url),
                note: asset.url ? "URL available" : "No URL"
              },
              {
                label: "Usages",
                ok: (asset.usageCount ?? 0) > 0,
                note: `${asset.usageCount ?? 0} attachment(s)`
              },
              {
                label: "Alt text",
                ok: !asset.health?.missingAlt,
                note: asset.altText?.trim() || "Missing"
              },
              {
                label: "Health",
                ok: warnings.length === 0,
                note: warnings.length === 0 ? "No issues detected" : `${warnings.length} warning(s)`
              }
            ]}
          />
        </>
      ) : (
        <p className="admin-config-text-muted text-sm">Loading…</p>
      )}
    </DetailsDrawerShell>

    <input
      ref={replaceInputRef}
      type="file"
      accept="image/*,video/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void onReplace(f);
        e.target.value = "";
      }}
    />

    {asset ? (
      <MediaDeleteSafetyModal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        token={token}
        restaurantId={restaurantId}
        assetId={asset.id}
        canDelete={canDelete}
        canEdit={canEdit}
        canUpload={canUpload}
        onReplaceEverywhere={() => replaceInputRef.current?.click()}
        onDone={() => {
          onChanged();
          void load();
          onClose();
        }}
      />
    ) : null}
    </>
  );
}
