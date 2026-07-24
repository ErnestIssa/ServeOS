import { useEffect, useRef, useState } from "react";
import { checkMediaDuplicate, type MediaDuplicateCheckAsset, type MediaImportSource } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { uploadLibraryMediaFile, type LibraryUploadImportMeta } from "./mediaLibraryUpload";
import { useAdminToast } from "../../AdminToast";
import { sha256HexOfFile } from "./mediaHash";
import { MediaDuplicateModal } from "./MediaDuplicateModal";
import {
  acquireCloudImportFiles,
  CLOUD_PROVIDERS,
  detectCameraSupported,
  type CloudImportFile,
  type CloudProviderId
} from "./cloudImportConnector";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  canUpload: boolean;
  onDone: () => void;
  onReuseExisting?: (assetId: string) => void;
};

type Step = "source" | "cloud" | "details" | "uploading" | "finishing";

type PendingImport = {
  files: File[];
  importMeta?: LibraryUploadImportMeta;
  providerLabel?: string;
};

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
  const [step, setStep] = useState<Step>("source");
  const [cameraOk, setCameraOk] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [cloudPhase, setCloudPhase] = useState("");
  const [activeCloud, setActiveCloud] = useState<CloudProviderId | null>(null);
  const [duplicate, setDuplicate] = useState<MediaDuplicateCheckAsset | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const file = pending?.files[0] ?? null;

  useEffect(() => {
    if (!open) return;
    void detectCameraSupported().then(setCameraOk);
  }, [open]);

  const reset = () => {
    setStep("source");
    setPending(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDisplayName("");
    setAltText("");
    setBusy(false);
    setStageLabel("");
    setCloudPhase("");
    setActiveCloud(null);
    setDuplicate(null);
    setShowCompare(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const acceptFiles = (
    list: File[] | FileList,
    meta?: { importSource?: MediaImportSource; importSourceId?: string; importOriginalPath?: string; providerLabel?: string }
  ) => {
    const next = [...list];
    if (next.length === 0) return;
    setPending({
      files: next,
      importMeta: meta?.importSource
        ? {
            importSource: meta.importSource,
            importSourceId: meta.importSourceId,
            importOriginalPath: meta.importOriginalPath
          }
        : { importSource: "DEVICE" },
      providerLabel: meta?.providerLabel
    });
    setDisplayName(next[0]!.name.replace(/\.[^.]+$/, ""));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(next[0]!));
    setStep("details");
  };

  const openDevicePicker = () => inputRef.current?.click();

  const openCamera = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => {
      if (input.files?.length) {
        acceptFiles(input.files, { importSource: "CAMERA" });
      }
    };
    input.click();
  };

  const startCloudImport = async (provider: CloudProviderId) => {
    if (!canUpload || busy) return;
    setBusy(true);
    setActiveCloud(provider);
    setStep("cloud");
    setCloudPhase("Connecting…");
    try {
      const imported = await acquireCloudImportFiles(provider, (p) => setCloudPhase(p.message));
      if (!imported.length) {
        setBusy(false);
        setActiveCloud(null);
        setStep("source");
        return;
      }
      applyCloudSelection(imported);
    } catch (e) {
      console.error(e);
      pushToast("Cloud import failed. Try again or use From device.", "error");
      setBusy(false);
      setActiveCloud(null);
      setStep("source");
    }
  };

  const applyCloudSelection = (imported: CloudImportFile[]) => {
    const files = imported.map((i) => i.file);
    const first = imported[0]!;
    setBusy(false);
    setActiveCloud(null);
    acceptFiles(files, {
      importSource: first.importSource,
      importSourceId: first.importSourceId,
      importOriginalPath: first.importOriginalPath,
      providerLabel: first.providerLabel
    });
  };

  const runUpload = async (forceNewAsset: boolean) => {
    if (!file || !pending || !canUpload) return;
    setBusy(true);
    setDuplicate(null);
    setStep("uploading");
    setStageLabel("Checking for duplicates…");
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const queue = forceNewAsset ? [file] : pending.files;
    let lastAssetId: string | null = null;

    for (let i = 0; i < queue.length; i++) {
      const f = queue[i]!;
      const cloudMeta =
        pending.importMeta?.importSource &&
        ["GOOGLE_DRIVE", "DROPBOX", "ONEDRIVE"].includes(pending.importMeta.importSource)
          ? {
              ...pending.importMeta,
              importSourceId:
                queue.length === 1
                  ? pending.importMeta.importSourceId
                  : `${pending.importMeta.importSourceId ?? "import"}_${i}`,
              importOriginalPath: f.name
            }
          : pending.importMeta;

      setStageLabel(
        queue.length > 1
          ? `Importing ${i + 1} of ${queue.length}…`
          : cloudMeta?.importSource && cloudMeta.importSource !== "DEVICE" && cloudMeta.importSource !== "CAMERA"
            ? "Copying into Media Platform…"
            : "Uploading original…"
      );

      const res = await uploadLibraryMediaFile(token, {
        restaurantId,
        file: f,
        kind: f.type.startsWith("video/") ? "video" : kind,
        displayName: i === 0 ? displayName.trim() || f.name : f.name.replace(/\.[^.]+$/, ""),
        altText: i === 0 ? altText.trim() || undefined : undefined,
        forceNewAsset,
        importMeta: cloudMeta,
        onStage: (label) => setStageLabel(label)
      });
      if (!res.ok) {
        setBusy(false);
        pushToast(res.error ?? "Upload failed.", "error");
        setStep("details");
        return;
      }
      lastAssetId = res.assetId;
    }

    setStep("finishing");
    setStageLabel("Finishing up…");
    await new Promise((r) => window.setTimeout(r, 450));
    setBusy(false);
    pushToast(
      queue.length > 1
        ? `${queue.length} files copied into Media Library.`
        : pending.providerLabel
          ? `Imported from ${pending.providerLabel} into Media Library.`
          : "Media added to the library.",
      "success"
    );
    reset();
    void lastAssetId;
    onDone();
    onClose();
  };

  const startUpload = async () => {
    if (!file || !canUpload) return;
    setBusy(true);
    setStep("uploading");
    setStageLabel("Checking for duplicates…");
    try {
      const sha = await sha256HexOfFile(file);
      const check = await checkMediaDuplicate(token, restaurantId, sha);
      if (check.ok && check.exists && check.asset && (pending?.files.length ?? 0) === 1) {
        setBusy(false);
        setDuplicate(check.asset);
        return;
      }
    } catch {
      /* proceed */
    }
    await runUpload(false);
  };

  const cloudLabel = activeCloud
    ? CLOUD_PROVIDERS.find((p) => p.id === activeCloud)?.label
    : pending?.providerLabel;

  return (
    <>
      <MenuPageModalShell
        open={open && !duplicate}
        onClose={close}
        title="Add media"
        description="Upload or import a copy into ServeOS — never linked to cloud drives."
        titleId="media-upload-flow"
        maxWidthClass="max-w-md"
        maxHeightClass="max-h-[min(92dvh,36rem)]"
        bodyScroll={false}
        busy={busy && (step === "uploading" || step === "finishing" || step === "cloud")}
        panelClassName="media-upload-modal"
      >
        {step === "source" ? (
          <div className="media-upload-source">
            <div className="media-upload-primary-row">
              {cameraOk ? (
                <button
                  type="button"
                  disabled={!canUpload}
                  className="media-upload-primary-btn"
                  onClick={openCamera}
                >
                  <span className="media-upload-primary-icon" aria-hidden>
                    <CameraGlyph />
                  </span>
                  <span className="media-upload-primary-title">Take photo</span>
                  <span className="media-upload-primary-hint">Use camera</span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={!canUpload}
                className="media-upload-primary-btn"
                onClick={openDevicePicker}
              >
                <span className="media-upload-primary-icon" aria-hidden>
                  <DeviceGlyph />
                </span>
                <span className="media-upload-primary-title">From device</span>
                <span className="media-upload-primary-hint">Browse or drop</span>
              </button>
            </div>

            <div
              className={`media-upload-drop ${dragOver ? "media-upload-drop--active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files, { importSource: "DEVICE" });
              }}
            >
              Drop files here
            </div>

            <div className="media-upload-divider">
              <span>Import from cloud</span>
            </div>
            <p className="media-upload-import-note">Copied into ServeOS · not linked</p>

            <div className="media-upload-cloud-row">
              {CLOUD_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!canUpload}
                  className="media-upload-cloud-btn"
                  onClick={() => void startCloudImport(p.id)}
                >
                  <img src={p.iconSrc} alt="" className="media-upload-cloud-icon" width={28} height={28} />
                  <span>{p.label}</span>
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
                if (e.target.files?.length) acceptFiles(e.target.files, { importSource: "DEVICE" });
                e.target.value = "";
              }}
            />
          </div>
        ) : null}

        {step === "cloud" ? (
          <div className="media-upload-loading">
            <div className="media-step-loader" aria-hidden />
            <p className="media-upload-loading-title">{cloudPhase || `Connecting to ${cloudLabel}…`}</p>
            <p className="media-upload-loading-sub">Import only · files become ServeOS assets</p>
          </div>
        ) : null}

        {step === "details" && file ? (
          <div className="media-upload-details">
            <div className="media-upload-details-preview">
              {previewUrl && file.type.startsWith("image/") ? (
                <img src={previewUrl} alt="" />
              ) : (
                <span className="media-upload-file-chip">{file.name}</span>
              )}
              <div className="media-upload-details-meta">
                {pending?.providerLabel ? (
                  <p className="media-upload-source-tag">Import · {pending.providerLabel}</p>
                ) : pending?.importMeta?.importSource === "CAMERA" ? (
                  <p className="media-upload-source-tag">Camera</p>
                ) : (
                  <p className="media-upload-source-tag">Device</p>
                )}
                {pending && pending.files.length > 1 ? (
                  <p className="text-xs admin-config-text-muted">{pending.files.length} files · name applies to first</p>
                ) : null}
              </div>
            </div>
            <label className="media-upload-field">
              Display name
              <input
                className="admin-config-input mt-1 w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="media-upload-field">
              Alt text
              <input
                className="admin-config-input mt-1 w-full"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe for accessibility"
              />
            </label>
            <ProfileModalFooter
              cancelLabel="Back"
              onCancel={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setPending(null);
                setStep("source");
              }}
              confirmLabel={
                pending && pending.files.length > 1
                  ? `Import ${pending.files.length}`
                  : pending?.providerLabel
                    ? "Import copy"
                    : "Upload"
              }
              confirmDisabled={!displayName.trim() || busy}
              onConfirm={() => void startUpload()}
            />
          </div>
        ) : null}

        {step === "uploading" ? (
          <div className="media-upload-loading">
            <div className="media-step-loader" aria-hidden />
            <p className="media-upload-loading-title media-upload-phrase">{stageLabel || "Working…"}</p>
            <p className="media-upload-loading-sub">Validate · EXIF strip · thumb · WebP · store</p>
          </div>
        ) : null}

        {step === "finishing" ? (
          <div className="media-upload-loading">
            <div className="media-final-loader" aria-hidden />
            <p className="media-upload-loading-title media-upload-phrase">{stageLabel || "Almost done…"}</p>
            <p className="media-upload-loading-sub">Saving to Media Library</p>
          </div>
        ) : null}
      </MenuPageModalShell>

      {duplicate && file ? (
        <MediaDuplicateModal
          open={Boolean(duplicate)}
          onClose={() => {
            setDuplicate(null);
            setShowCompare(false);
            setStep("details");
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

function CameraGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6A1.5 1.5 0 0 1 10 3.5h4a1.5 1.5 0 0 1 1.2.9L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function DeviceGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4.75h10A1.75 1.75 0 0 1 18.75 6.5v11A1.75 1.75 0 0 1 17 19.25H7A1.75 1.75 0 0 1 5.25 17.5v-11A1.75 1.75 0 0 1 7 4.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M9 8.5h6M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
