import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMediaLibraryAsset,
  patchMediaLibraryAsset,
  replaceMediaLibraryAsset,
  rollbackMediaLibraryAsset,
  type MediaLibraryDetail
} from "../../../api";
import {
  DetailsDrawerShell,
  DetailsGrid,
  DetailsRow,
  DetailsSection,
  DetailsSystemStatus,
  formatDetailsWhen,
  shortEntityId
} from "../menu/detailsDrawerUi";
import { useAdminToast } from "../../AdminToast";
import { AdminBtnSecondary } from "../../AdminUi";
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

type HealthCheck = { id: string; label: string; ok: boolean };

function buildHealthChecks(asset: MediaLibraryDetail): HealthCheck[] {
  return [
    { id: "alt", label: "Alt text present", ok: !asset.health?.missingAlt },
    { id: "used", label: "Used somewhere", ok: !asset.health?.unused },
    { id: "size", label: "Reasonable file size", ok: !asset.health?.largeFile },
    { id: "pipeline", label: "Processing OK", ok: !asset.health?.processingFailed },
    { id: "thumb", label: "Has thumbnail", ok: asset.health?.hasThumb !== false },
    { id: "webp", label: "Has WebP", ok: asset.health?.hasWebp !== false }
  ];
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

  const savedName = asset?.displayName || asset?.originalName || "";
  const savedAlt = asset?.altText || "";
  const metaDirty = Boolean(asset) && (name.trim() !== savedName.trim() || alt !== savedAlt);
  const canSaveMeta = canEdit && metaDirty && !busy;

  const healthChecks = useMemo(() => (asset ? buildHealthChecks(asset) : []), [asset]);
  const failingChecks = healthChecks.filter((c) => !c.ok);
  const healthReady = failingChecks.length === 0;

  const saveMeta = async () => {
    if (!asset || !canSaveMeta) return;
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

  const onArchive = async (archived: boolean) => {
    if (!asset || !canEdit) return;
    setBusy(true);
    const res = await patchMediaLibraryAsset(token, restaurantId, asset.id, { archived });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? "Could not update archive state.", "error");
      return;
    }
    pushToast(archived ? "Asset archived." : "Asset restored.", "success");
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
                {asset.importSource ? (
                  <DetailsRow
                    label="Import source"
                    value={String(asset.importSource).replaceAll("_", " ")}
                  />
                ) : null}
                {asset.importedAt ? (
                  <DetailsRow label="Imported" value={formatDetailsWhen(asset.importedAt)} />
                ) : null}
                {asset.importSourceId ? (
                  <DetailsRow label="Source id" value={shortEntityId(asset.importSourceId)} />
                ) : null}
              </DetailsGrid>
            </DetailsSection>

            {canEdit ? (
              <DetailsSection title="Metadata">
                <div className="media-details-meta">
                  <label className="media-details-meta__field">
                    <span className="media-details-meta__label">Display name</span>
                    <input
                      className="admin-config-input media-details-meta__input"
                      value={name}
                      disabled={busy}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="media-details-meta__field">
                    <span className="media-details-meta__label">Alt text</span>
                    <input
                      className="admin-config-input media-details-meta__input"
                      value={alt}
                      disabled={busy}
                      onChange={(e) => setAlt(e.target.value)}
                      placeholder="Describe the image"
                    />
                  </label>
                  <div className="media-details-meta__actions">
                    <button
                      type="button"
                      className={`media-details-meta__save${canSaveMeta ? " is-ready" : ""}`}
                      disabled={!canSaveMeta}
                      onClick={() => void saveMeta()}
                    >
                      {busy && metaDirty ? "Saving…" : "Save metadata"}
                    </button>
                  </div>
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
            </DetailsSection>

            {(canUpload || canEdit) && !asset.archivedAt ? (
              <DetailsSection title="Actions">
                <div className="media-details-actions">
                  {canUpload ? (
                    <button
                      type="button"
                      className="media-details-action media-details-action--replace"
                      disabled={busy}
                      onClick={() => replaceInputRef.current?.click()}
                    >
                      <span className="media-details-action__label">Replace asset</span>
                      <span className="media-details-action__desc">Keep the same ID · update all usages</span>
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className="media-details-action media-details-action--archive"
                      disabled={busy}
                      onClick={() => void onArchive(true)}
                    >
                      <span className="media-details-action__label">Archive</span>
                      <span className="media-details-action__desc">Hide from library · restore later</span>
                    </button>
                  ) : null}
                  {canEdit || canDelete ? (
                    <button
                      type="button"
                      className="media-details-action media-details-action--remove"
                      disabled={busy}
                      onClick={() => setRemoveOpen(true)}
                    >
                      <span className="media-details-action__label">Remove…</span>
                      <span className="media-details-action__desc">Safety checks before delete</span>
                    </button>
                  ) : null}
                </div>
              </DetailsSection>
            ) : null}

            {asset.archivedAt && canEdit ? (
              <DetailsSection title="Actions">
                <div className="media-details-actions">
                  <button
                    type="button"
                    className="media-details-action media-details-action--restore"
                    disabled={busy}
                    onClick={() => void onArchive(false)}
                  >
                    <span className="media-details-action__label">Restore from archive</span>
                    <span className="media-details-action__desc">Bring back to the active library</span>
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="media-details-action media-details-action--remove"
                      disabled={busy}
                      onClick={() => setRemoveOpen(true)}
                    >
                      <span className="media-details-action__label">Delete permanently…</span>
                      <span className="media-details-action__desc">Safety checks before hard delete</span>
                    </button>
                  ) : null}
                </div>
              </DetailsSection>
            ) : null}

            <DetailsSection title="Storage">
              <DetailsGrid>
                <DetailsRow label="Object key" value={shortEntityId(asset.objectKey)} />
                <DetailsRow label="Original key" value={shortEntityId(asset.originalObjectKey ?? asset.objectKey)} />
                <DetailsRow label="Visibility" value={asset.visibility ?? "PRIVATE"} />
                <DetailsRow label="Processing" value={asset.processingStatus ?? "READY"} />
              </DetailsGrid>
            </DetailsSection>

            <DetailsSection title="Health">
              <div className={`media-details-health${healthReady ? " is-ready" : " has-warnings"}`}>
                <p className="media-details-health__status">
                  {healthReady ? "Healthy" : "Needs attention"}
                </p>
                <ul className="media-details-health__checks" aria-label="Health checks">
                  {healthChecks.map((check) => (
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
              </div>
            </DetailsSection>

            {canEdit ? (
              <div className="mt-2">
                <AdminBtnSecondary disabled={busy} onClick={() => void toggleFavorite()}>
                  {asset.favorite ? "Unfavorite" : "Favorite"}
                </AdminBtnSecondary>
              </div>
            ) : null}

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
                  ok: healthReady,
                  note: healthReady ? "No issues detected" : `${failingChecks.length} check(s) failing`
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
          assetName={asset.displayName || asset.originalName || undefined}
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
