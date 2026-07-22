import { useEffect, useMemo, useState } from "react";
import {
  duplicateMediaAssetUsage,
  listMediaAssets,
  type MediaAssetRow,
  type MenuSurfaceRow
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { useAdminToast } from "../../AdminToast";
import {
  MenuPageModalShell,
  ProfileModalFooter,
  ProfileModalNote
} from "./menuPageModalShell";

type ItemOption = { id: string; name: string; categoryName: string };

type Props = {
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  items: ItemOption[];
  canUpload: boolean;
  canView: boolean;
};

export function MediaAssetLibrary({ token, restaurantId, menus, items, canUpload, canView }: Props) {
  const { pushToast } = useAdminToast();
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dupAsset, setDupAsset] = useState<MediaAssetRow | null>(null);
  const [targetKind, setTargetKind] = useState<"MENU_COVER" | "MENU_ITEM">("MENU_ITEM");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!canView) return;
    setLoading(true);
    const res = await listMediaAssets(token, restaurantId);
    setLoading(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not load assets.");
      return;
    }
    setAssets(res.assets ?? []);
    setError(null);
  };

  useEffect(() => {
    void refresh();
  }, [token, restaurantId, canView]);

  const liveMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);

  useEffect(() => {
    if (!dupAsset) return;
    if (targetKind === "MENU_ITEM") setTargetId(items[0]?.id ?? "");
    else setTargetId(liveMenus[0]?.id ?? "");
  }, [dupAsset, targetKind, items, liveMenus]);

  const targetOptions =
    targetKind === "MENU_ITEM"
      ? items.map((i) => ({ value: i.id, label: `${i.name} (${i.categoryName})` }))
      : liveMenus.map((m) => ({ value: m.id, label: m.name }));

  const runDuplicate = async () => {
    if (!dupAsset || !targetId || !canUpload) return;
    setBusy(true);
    const res = await duplicateMediaAssetUsage(token, restaurantId, dupAsset.id, {
      targetType: targetKind,
      targetId,
      role: targetKind === "MENU_COVER" ? "COVER" : "GALLERY"
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not duplicate reference.", "error");
      return;
    }
    pushToast("Media reference duplicated — same file, new usage.", "success");
    setDupAsset(null);
    void refresh();
  };

  if (!canView) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold admin-config-text">Asset library</h4>
          <p className="text-xs admin-config-text-muted">
            Shared files with usage counts. Duplicate reference never re-uploads to storage.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading && assets.length === 0 ? (
        <p className="text-sm admin-config-text-muted">Loading assets…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm admin-config-text-muted">No assets yet. Upload images or videos to build the library.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <li
              key={a.id}
              className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                {a.url && a.contentType.startsWith("image/") ? (
                  <img src={a.url} alt={a.originalName ?? "Asset"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs admin-config-text-muted">
                    {a.contentType.startsWith("video/") ? "Video" : a.contentType}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium admin-config-text">
                  {a.originalName ?? a.objectKey.split("/").pop() ?? "Asset"}
                </p>
                <p className="mt-1 text-xs admin-config-text-muted">
                  Used by {a.usageCount} · {(a.byteSize / 1024).toFixed(0)} KB
                </p>
                {canUpload ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium underline"
                    onClick={() => setDupAsset(a)}
                  >
                    Duplicate reference
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <MenuPageModalShell
        open={Boolean(dupAsset)}
        onClose={busy ? () => undefined : () => setDupAsset(null)}
        title="Duplicate media reference"
        description="Attach the same file to another menu cover or item. No new upload."
        titleId="dup-media-ref-title"
        stackLevel="overlay"
      >
        <AdminBubbleDropdown
          label="Attach as"
          value={targetKind}
          options={[
            { value: "MENU_ITEM", label: "Item gallery" },
            { value: "MENU_COVER", label: "Menu cover" }
          ]}
          onChange={(v) => setTargetKind(v as "MENU_COVER" | "MENU_ITEM")}
          disabled={busy}
          containWithinModal
          dropInline
        />
        <div className="mt-3">
          {targetOptions.length > 0 ? (
            <AdminBubbleDropdown
              label="Destination"
              value={targetId}
              options={targetOptions}
              onChange={setTargetId}
              disabled={busy}
              containWithinModal
              dropInline
            />
          ) : (
            <ProfileModalNote>No destinations available.</ProfileModalNote>
          )}
        </div>
        <ProfileModalNote>Same S3 object — only a new usage record is created.</ProfileModalNote>
        <ProfileModalFooter
          onCancel={() => setDupAsset(null)}
          onConfirm={() => void runDuplicate()}
          confirmLabel={busy ? "Attaching…" : "Create reference"}
          busy={busy}
          confirmDisabled={!targetId || busy}
        />
      </MenuPageModalShell>
    </div>
  );
}
