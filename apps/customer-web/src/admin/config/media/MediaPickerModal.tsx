import { useEffect, useRef, useState } from "react";
import {
  attachMediaLibraryAsset,
  checkMediaDuplicate,
  listMediaLibrary,
  type MediaDuplicateCheckAsset,
  type MediaLibraryAsset,
  type MenuSurfaceRow
} from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { uploadLibraryMediaFile } from "./mediaLibraryUpload";
import { useAdminToast } from "../../AdminToast";
import { sha256HexOfFile } from "./mediaHash";
import { MediaDuplicateModal } from "./MediaDuplicateModal";

export type MediaAttachTarget = {
  targetType:
    | "MENU_COVER"
    | "MENU_ITEM"
    | "CATEGORY"
    | "VENUE_LOGO"
    | "VENUE_COVER"
    | "STAFF_AVATAR"
    | "CUSTOMER_AVATAR";
  targetId: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  canUpload: boolean;
  menus?: MenuSurfaceRow[];
  items?: Array<{ id: string; name: string; categoryName: string }>;
  attachTarget?: MediaAttachTarget | null;
  accept?: string;
  title?: string;
  description?: string;
  onAttached: () => void;
};

function roleForTarget(targetType: MediaAttachTarget["targetType"]) {
  if (targetType === "MENU_COVER" || targetType === "VENUE_COVER") return "COVER" as const;
  if (targetType === "VENUE_LOGO" || targetType === "STAFF_AVATAR" || targetType === "CUSTOMER_AVATAR") {
    return "PRIMARY" as const;
  }
  return "GALLERY" as const;
}

export function MediaPickerModal({
  open,
  onClose,
  token,
  restaurantId,
  canUpload,
  menus = [],
  items = [],
  attachTarget = null,
  accept = "image/*,video/*",
  title = "Choose media",
  description = "Pick from the venue Media Library or upload new. One Media Platform for every ServeOS surface.",
  onAttached
}: Props) {
  const { pushToast } = useAdminToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"choose" | "upload">("choose");
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [localTarget, setLocalTarget] = useState(attachTarget);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<MediaDuplicateCheckAsset | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocalTarget(attachTarget);
    setMode("choose");
    setDuplicate(null);
    setPendingFile(null);
    setProgress(0);
    setStageLabel("");
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    void (async () => {
      const res = await listMediaLibrary(token, restaurantId, {
        pageSize: 48,
        type: accept.includes("video") && !accept.includes("image") ? "video" : "image"
      });
      if (res.ok) setAssets(res.assets ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      role: roleForTarget(target.targetType)
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Attach failed.", "error");
      return;
    }
    onAttached();
    onClose();
  };

  const finishUpload = async (file: File, forceNewAsset: boolean) => {
    setBusy(true);
    setDuplicate(null);
    setMode("upload");
    setProgress(15);
    setStageLabel("Uploading…");
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const uploaded = await uploadLibraryMediaFile(token, {
      restaurantId,
      file,
      kind,
      displayName: file.name,
      forceNewAsset,
      onJobId: () => {
        setProgress(45);
        setStageLabel("Processing · thumbnails & WebP…");
      }
    });
    if (!uploaded.ok || !uploaded.assetId) {
      setBusy(false);
      setProgress(0);
      pushToast(uploaded.ok ? "Uploaded but asset id missing." : uploaded.error ?? "Upload failed.", "error");
      return;
    }
    setProgress(90);
    if (localTarget) {
      await attach(uploaded.assetId);
    } else {
      setBusy(false);
      setProgress(100);
      pushToast("Uploaded to Media Library.", "success");
      onAttached();
      onClose();
    }
  };

  const uploadNew = async (file: File) => {
    if (!canUpload) return;
    setBusy(true);
    const preview = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreview(preview);
    setStageLabel("Checking duplicates…");
    setProgress(8);
    try {
      const sha = await sha256HexOfFile(file);
      const check = await checkMediaDuplicate(token, restaurantId, sha);
      if (check.ok && check.exists && check.asset) {
        setBusy(false);
        setDuplicate(check.asset);
        return;
      }
    } catch {
      /* continue */
    }
    await finishUpload(file, false);
  };

  return (
    <>
      <MenuPageModalShell
        open={open && !duplicate}
        onClose={busy ? () => undefined : onClose}
        title={title}
        description={description}
        titleId="media-picker-modal"
        maxWidthClass="max-w-2xl"
      >
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
          {(
            [
              ["choose", "Library"],
              ["upload", "Upload"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={id === "upload" && !canUpload}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${
                mode === id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {!localTarget ? (
          <div className="mb-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] admin-config-text-muted">
              Destination
            </p>
            <select
              className="admin-config-input w-full"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [kind, id] = v.split(":");
                if (kind === "cover") setLocalTarget({ targetType: "MENU_COVER", targetId: id });
                if (kind === "item") setLocalTarget({ targetType: "MENU_ITEM", targetId: id });
                if (kind === "logo") setLocalTarget({ targetType: "VENUE_LOGO", targetId: id });
                if (kind === "vcover") setLocalTarget({ targetType: "VENUE_COVER", targetId: id });
              }}
            >
              <option value="">Select destination…</option>
              {menus.map((m) => (
                <option key={m.id} value={`cover:${m.id}`}>
                  Menu cover · {m.name}
                </option>
              ))}
              {items.map((i) => (
                <option key={i.id} value={`item:${i.id}`}>
                  Item · {i.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs admin-config-text-muted dark:bg-slate-900/40">
            Attaching as <strong className="admin-config-text">{localTarget.targetType}</strong>
          </p>
        )}

        {mode === "choose" ? (
          <div className="admin-menu-media-grid max-h-[48vh] overflow-y-auto">
            {assets.length === 0 ? (
              <p className="col-span-full text-sm admin-config-text-muted">
                Library is empty — switch to Upload.
              </p>
            ) : (
              assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="admin-menu-media-card text-left transition hover:ring-2 hover:ring-slate-400/40"
                  disabled={busy}
                  onClick={() => void attach(a.id)}
                >
                  {a.url ? (
                    <img src={a.url} alt="" className="admin-menu-media-card__preview" />
                  ) : (
                    <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">
                      Media
                    </div>
                  )}
                  <div className="admin-menu-media-card__meta">
                    <span className="truncate text-xs font-semibold">
                      {a.displayName || a.originalName}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                dragOver
                  ? "border-slate-500 bg-slate-100/80 dark:bg-slate-800/50"
                  : "border-slate-300/80 dark:border-slate-600"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void uploadNew(f);
              }}
            >
              <p className="font-display text-lg font-bold admin-config-text">Drop files here</p>
              <p className="mt-1 text-sm admin-config-text-muted">
                or browse · camera on phone · paste coming soon
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  disabled={!canUpload || busy}
                  onClick={() => fileRef.current?.click()}
                >
                  Browse files
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold admin-config-text disabled:opacity-50 dark:border-slate-600"
                  disabled={!canUpload || busy}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.setAttribute("capture", "environment");
                    input.onchange = () => {
                      const f = input.files?.[0];
                      if (f) void uploadNew(f);
                    };
                    input.click();
                  }}
                >
                  Take photo
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  void (async () => {
                    for (const f of files) await uploadNew(f);
                  })();
                }}
              />
            </div>
            {busy || progress > 0 ? (
              <div>
                <div className="mb-1 flex justify-between text-xs admin-config-text-muted">
                  <span>{stageLabel || "Working…"}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all dark:bg-white"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <ProfileModalFooter cancelLabel="Close" onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
      </MenuPageModalShell>

      {duplicate && pendingFile ? (
        <MediaDuplicateModal
          open
          onClose={() => {
            setDuplicate(null);
            setShowCompare(false);
            if (pendingPreview) URL.revokeObjectURL(pendingPreview);
            setPendingPreview(null);
            setPendingFile(null);
          }}
          existing={duplicate}
          localPreviewUrl={pendingPreview}
          localName={pendingFile.name}
          showCompare={showCompare}
          onToggleCompare={() => setShowCompare((v) => !v)}
          onReuse={() => {
            const id = duplicate.id;
            setDuplicate(null);
            if (pendingPreview) URL.revokeObjectURL(pendingPreview);
            setPendingPreview(null);
            setPendingFile(null);
            void attach(id);
          }}
          onUploadAnyway={() => void finishUpload(pendingFile, true)}
        />
      ) : null}
    </>
  );
}
