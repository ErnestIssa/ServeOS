import { useRef, useState } from "react";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { uploadLibraryMediaFile } from "./mediaLibraryUpload";
import { useAdminToast } from "../../AdminToast";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  canUpload: boolean;
  onDone: () => void;
};

const CLOUD_SOURCES = [
  { id: "files", label: "Upload files", available: true },
  { id: "google_drive", label: "Google Drive", available: false },
  { id: "dropbox", label: "Dropbox", available: false },
  { id: "onedrive", label: "OneDrive", available: false }
] as const;

export function MediaUploadFlowModal({ open, onClose, token, restaurantId, canUpload, onDone }: Props) {
  const { pushToast } = useAdminToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"source" | "preview" | "meta" | "uploading">("source");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState("");

  const reset = () => {
    setStep("source");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDisplayName("");
    setAltText("");
    setBusy(false);
    setStageLabel("");
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pickFile = (f: File) => {
    setFile(f);
    setDisplayName(f.name.replace(/\.[^.]+$/, ""));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("preview");
  };

  const startUpload = async () => {
    if (!file || !canUpload) return;
    setBusy(true);
    setStep("uploading");
    setStageLabel("Uploading…");
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const res = await uploadLibraryMediaFile(token, {
      restaurantId,
      file,
      kind,
      displayName: displayName.trim() || file.name,
      altText: altText.trim() || undefined,
      onJobId: () => setStageLabel("Queued · optimizing metadata…")
    });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.error ?? "Upload failed.", "error");
      setStep("meta");
      return;
    }
    pushToast("Media added to the library.", "success");
    reset();
    onDone();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={close}
      title="Add media"
      description="Choose a source, preview, add optional metadata, then upload into the restaurant Media Library."
      titleId="media-upload-flow"
      maxWidthClass="max-w-lg"
    >
      {step === "source" ? (
        <div className="space-y-2">
          {CLOUD_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!s.available || !canUpload}
              className="admin-search-result-card w-full text-left disabled:opacity-50"
              onClick={() => {
                if (s.id === "files") inputRef.current?.click();
              }}
            >
              <p className="font-semibold admin-config-text">{s.label}</p>
              {!s.available ? (
                <p className="text-xs admin-config-text-muted">Coming later</p>
              ) : (
                <p className="text-xs admin-config-text-muted">Desktop files · drag & drop supported next</p>
              )}
            </button>
          ))}
          <div
            className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm admin-config-text-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
          >
            Drag & drop a file here
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {step === "preview" && file ? (
        <div className="space-y-3">
          {previewUrl && file.type.startsWith("image/") ? (
            <img src={previewUrl} alt="" className="max-h-56 w-full rounded-xl object-contain" />
          ) : (
            <p className="text-sm admin-config-text-muted">{file.name}</p>
          )}
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
            Name (required)
            <input
              className="admin-config-input mt-1 w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-bold admin-config-text-muted">
            Alt text (optional)
            <input
              className="admin-config-input mt-1 w-full"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
            />
          </label>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setStep("preview")}
            confirmLabel="Upload"
            confirmDisabled={!displayName.trim() || busy}
            onConfirm={() => void startUpload()}
          />
        </div>
      ) : null}

      {step === "uploading" ? (
        <div className="space-y-2 py-6 text-center">
          <p className="font-semibold admin-config-text">{stageLabel || "Uploading…"}</p>
          <p className="text-xs admin-config-text-muted">Hashing · metadata · CDN · ready</p>
        </div>
      ) : null}
    </MenuPageModalShell>
  );
}
