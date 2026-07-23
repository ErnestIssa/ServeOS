import { useEffect, useState } from "react";
import {
  attachMediaLibraryAsset,
  listMediaLibrary,
  type MediaLibraryAsset,
  type MenuSurfaceRow
} from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { uploadLibraryMediaFile } from "./mediaLibraryUpload";
import { useAdminToast } from "../../AdminToast";
import { AdminBtnPrimary } from "../../AdminUi";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  canUpload: boolean;
  menus: MenuSurfaceRow[];
  items: Array<{ id: string; name: string; categoryName: string }>;
  /** When set, picker attaches to this target after choose/upload. */
  attachTarget?: {
    targetType: "MENU_COVER" | "MENU_ITEM";
    targetId: string;
  } | null;
  onAttached: () => void;
};

export function MediaPickerModal({
  open,
  onClose,
  token,
  restaurantId,
  canUpload,
  menus,
  items,
  attachTarget = null,
  onAttached
}: Props) {
  const { pushToast } = useAdminToast();
  const [mode, setMode] = useState<"choose" | "upload">("choose");
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [localTarget, setLocalTarget] = useState(attachTarget);

  useEffect(() => {
    if (!open) return;
    setLocalTarget(attachTarget);
    setMode("choose");
    void (async () => {
      const res = await listMediaLibrary(token, restaurantId, { pageSize: 48, type: "image" });
      if (res.ok) setAssets(res.assets ?? []);
    })();
  }, [open, token, restaurantId, attachTarget]);

  const attach = async (assetId: string) => {
    const target = localTarget;
    if (!target) {
      pushToast("Pick a destination first.", "error");
      return;
    }
    setBusy(true);
    const res = await attachMediaLibraryAsset(token, restaurantId, assetId, {
      targetType: target.targetType,
      targetId: target.targetId,
      role: target.targetType === "MENU_COVER" ? "COVER" : "GALLERY"
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Attach failed.", "error");
      return;
    }
    onAttached();
    onClose();
  };

  const uploadNew = async (file: File) => {
    if (!canUpload) return;
    setBusy(true);
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const uploaded = await uploadLibraryMediaFile(token, {
      restaurantId,
      file,
      kind,
      displayName: file.name
    });
    if (!uploaded.ok || !uploaded.assetId) {
      setBusy(false);
      pushToast(uploaded.ok ? "Uploaded but asset id missing." : uploaded.error ?? "Upload failed.", "error");
      return;
    }
    if (localTarget) {
      await attach(uploaded.assetId);
    } else {
      setBusy(false);
      pushToast("Uploaded to library.", "success");
      onAttached();
      onClose();
    }
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Choose media"
      description="Pick an existing library asset or upload a new one. Media lives in the restaurant library — not inside a single menu row."
      titleId="media-picker-modal"
      maxWidthClass="max-w-2xl"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`admin-menu-tab-chip${mode === "choose" ? " is-active" : ""}`}
          onClick={() => setMode("choose")}
        >
          Choose existing
        </button>
        <button
          type="button"
          className={`admin-menu-tab-chip${mode === "upload" ? " is-active" : ""}`}
          onClick={() => setMode("upload")}
          disabled={!canUpload}
        >
          Upload new
        </button>
      </div>

      {!localTarget ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-bold uppercase admin-config-text-muted">Destination</p>
          <select
            className="admin-config-input w-full"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const [kind, id] = v.split(":");
              if (kind === "cover") setLocalTarget({ targetType: "MENU_COVER", targetId: id });
              if (kind === "item") setLocalTarget({ targetType: "MENU_ITEM", targetId: id });
            }}
          >
            <option value="">Select menu cover or item…</option>
            {menus.map((m) => (
              <option key={m.id} value={`cover:${m.id}`}>
                Cover · {m.name}
              </option>
            ))}
            {items.map((i) => (
              <option key={i.id} value={`item:${i.id}`}>
                Item · {i.name} ({i.categoryName})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mb-3 text-xs admin-config-text-muted">
          Attaching to {localTarget.targetType} · {localTarget.targetId.slice(0, 8)}…
        </p>
      )}

      {mode === "choose" ? (
        <div className="admin-menu-media-grid max-h-[50vh] overflow-y-auto">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              className="admin-menu-media-card text-left"
              disabled={busy}
              onClick={() => void attach(a.id)}
            >
              {a.url ? (
                <img src={a.url} alt="" className="admin-menu-media-card__preview" />
              ) : (
                <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Image</div>
              )}
              <div className="admin-menu-media-card__meta">
                <span className="truncate text-xs">{a.displayName || a.originalName}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AdminBtnPrimary
            disabled={!canUpload || busy}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*,video/*";
              input.onchange = () => {
                const f = input.files?.[0];
                if (f) void uploadNew(f);
              };
              input.click();
            }}
          >
            Pick file to upload
          </AdminBtnPrimary>
        </div>
      )}

      <ProfileModalFooter cancelLabel="Close" onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
