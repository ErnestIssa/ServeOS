import { useRef, useState } from "react";
import { checkMediaDuplicate, type MediaDuplicateCheckAsset } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { uploadLibraryMediaFile } from "./mediaLibraryUpload";
import { useAdminToast } from "../../AdminToast";
import { sha256HexOfFile } from "./mediaHash";
import { MediaDuplicateModal } from "./MediaDuplicateModal";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  canUpload: boolean;
  onDone: () => void;
  onReuseExisting?: (assetId: string) => void;
};

const CLOUD_SOURCES = [
  { id: "files", label: "This device", available: true, hint: "Files, photos, drag & drop" },
  { id: "camera", label: "Camera", available: true, hint: "Capture on phone or tablet" },
  { id: "google_drive", label: "Google Drive", available: false, hint: "Coming later" },
  { id: "dropbox", label: "Dropbox", available: false, hint: "Coming later" },
  { id: "onedrive", label: "OneDrive", available: false, hint: "Coming later" }
] as const;

export function MediaUploadFlowModal({
  open,
  onClose,
  token,
  restaurantId,
  canUpload,
  onDone,
  onReuseExisting
}: Props) {
  const { pushToast } = useAdminToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"source" | "preview" | "meta" | "uploading">("source");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [duplicate, setDuplicate] = useState<MediaDuplicateCheckAsset | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const file = files[0] ?? null;

  const reset = () => {
    setStep("source");
    setFiles([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDisplayName("");
    setAltText("");
    setBusy(false);
    setProgress(0);
    setStageLabel("");
    setDuplicate(null);
    setShowCompare(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pickFiles = (list: FileList | File[]) => {
    const next = [...list];
    if (next.length === 0) return;
    setFiles(next);
    setDisplayName(next[0]!.name.replace(/\.[^.]+$/, ""));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(next[0]!));
    setStep("preview");
  };

  const runUpload = async (forceNewAsset: boolean) => {
    if (!file || !canUpload) return;
    setBusy(true);
    setDuplicate(null);
    setStep("uploading");
    setProgress(12);
    setStageLabel("Uploading original…");
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const queue = forceNewAsset ? [file] : files;
    let lastAssetId: string | null = null;
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i]!;
      setStageLabel(`File ${i + 1} of ${queue.length}…`);
      setProgress(20 + Math.round((i / queue.length) * 50));
      const res = await uploadLibraryMediaFile(token, {
        restaurantId,
        file: f,
        kind: f.type.startsWith("video/") ? "video" : kind,
        displayName: i === 0 ? displayName.trim() || f.name : f.name.replace(/\.[^.]+$/, ""),
        altText: i === 0 ? altText.trim() || undefined : undefined,
        forceNewAsset,
        onJobId: () => {
          setProgress(70 + Math.round((i / queue.length) * 20));
          setStageLabel("Processing · validate · thumb · WebP…");
        }
      });
      if (!res.ok) {
        setBusy(false);
        pushToast(res.error ?? "Upload failed.", "error");
        setStep("meta");
        return;
      }
      lastAssetId = res.assetId;
    }
    setProgress(100);
    setBusy(false);
    pushToast(
      queue.length > 1 ? `${queue.length} files added to Media Library.` : "Media added to the library.",
      "success"
    );
    reset();
    if (lastAssetId && forceNewAsset === false && onReuseExisting && queue.length === 1) {
      /* keep library refresh via onDone */
    }
    onDone();
    onClose();
  };

  const startUpload = async () => {
    if (!file || !canUpload) return;
    setBusy(true);
    setStageLabel("Checking for duplicates…");
    setProgress(5);
    try {
      const sha = await sha256HexOfFile(file);
      const check = await checkMediaDuplicate(token, restaurantId, sha);
      if (check.ok && check.exists && check.asset && files.length === 1) {
        setBusy(false);
        setDuplicate(check.asset);
        return;
      }
    } catch {
      /* proceed */
    }
    await runUpload(false);
  };

  return (
    <>
      <MenuPageModalShell
        open={open && !duplicate}
        onClose={close}
        title="Add media"
        description="Upload into the ServeOS Media Platform — shared by menus, venue branding, and more."
        titleId="media-upload-flow"
        maxWidthClass="max-w-lg"
      >
        {step === "source" ? (
          <div className="space-y-3">
            <div
              className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragOver ? "border-slate-500 bg-slate-50 dark:bg-slate-800/40" : "border-slate-300 dark:border-slate-600"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) pickFiles(e.dataTransfer.files);
              }}
            >
              <p className="font-display text-lg font-bold admin-config-text">Drop files to upload</p>
              <p className="mt-1 text-sm admin-config-text-muted">Images & short videos · multi-select supported</p>
            </div>
            <div className="space-y-2">
              {CLOUD_SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={!s.available || !canUpload}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-45 dark:border-slate-700/50 dark:hover:bg-slate-900/40"
                  onClick={() => {
                    if (s.id === "files") inputRef.current?.click();
                    if (s.id === "camera") {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.setAttribute("capture", "environment");
                      input.onchange = () => {
                        if (input.files?.length) pickFiles(input.files);
                      };
                      input.click();
                    }
                  }}
                >
                  <span>
                    <span className="block font-semibold admin-config-text">{s.label}</span>
                    <span className="text-xs admin-config-text-muted">{s.hint}</span>
                  </span>
                  {!s.available ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Later</span>
                  ) : null}
                </button>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        ) : null}

        {step === "preview" && file ? (
          <div className="space-y-3">
            {previewUrl && file.type.startsWith("image/") ? (
              <img src={previewUrl} alt="" className="max-h-56 w-full rounded-2xl object-contain" />
            ) : (
              <p className="text-sm admin-config-text-muted">{file.name}</p>
            )}
            {files.length > 1 ? (
              <p className="text-xs admin-config-text-muted">{files.length} files selected · metadata applies to the first</p>
            ) : null}
            <ProfileModalFooter
              cancelLabel="Back"
              onCancel={() => setStep("source")}
              confirmLabel="Continue"
              onConfirm={() => setStep("meta")}
            />
          </div>
        ) : null}

        {step === "meta" && file ? (
          <div className="space-y-3">
            <label className="block text-xs font-bold admin-config-text-muted">
              Display name
              <input
                className="admin-config-input mt-1 w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="block text-xs font-bold admin-config-text-muted">
              Alt text
              <input
                className="admin-config-input mt-1 w-full"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for accessibility"
              />
            </label>
            <ProfileModalFooter
              cancelLabel="Back"
              onCancel={() => setStep("preview")}
              confirmLabel={files.length > 1 ? `Upload ${files.length}` : "Upload"}
              confirmDisabled={!displayName.trim() || busy}
              onConfirm={() => void startUpload()}
            />
          </div>
        ) : null}

        {step === "uploading" ? (
          <div className="space-y-3 py-6">
            <p className="text-center font-semibold admin-config-text">{stageLabel || "Uploading…"}</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-slate-900 transition-all dark:bg-white"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="text-center text-xs admin-config-text-muted">
              Magic validate · EXIF strip · thumb · WebP · BlurHash · CDN
            </p>
          </div>
        ) : null}
      </MenuPageModalShell>

      {duplicate && file ? (
        <MediaDuplicateModal
          open={Boolean(duplicate)}
          onClose={() => {
            setDuplicate(null);
            setShowCompare(false);
            setStep("meta");
          }}
          existing={duplicate}
          localPreviewUrl={previewUrl}
          localName={file.name}
          showCompare={showCompare}
          onToggleCompare={() => setShowCompare((v) => !v)}
          onReuse={() => {
            const id = duplicate.id;
            setDuplicate(null);
            reset();
            onReuseExisting?.(id);
            onDone();
            onClose();
            pushToast("Reusing existing library asset.", "success");
          }}
          onUploadAnyway={() => void runUpload(true)}
        />
      ) : null}
    </>
  );
}
