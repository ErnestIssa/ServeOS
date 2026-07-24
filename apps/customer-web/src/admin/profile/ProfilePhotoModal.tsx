import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileModalAlert, ProfileModalFooter, ProfileModalShell } from "./ProfileModalShell";

const VIEWPORT = 280;
const OUTPUT = 512;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  open: boolean;
  busy: boolean;
  currentImageUrl?: string | null;
  onClose: () => void;
  onSave: (file: File) => Promise<{ ok: boolean; error?: string }>;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load_failed"));
    img.src = url;
  });
}

async function renderCroppedFile(
  img: HTMLImageElement,
  scale: number,
  offsetX: number,
  offsetY: number
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const x = (VIEWPORT - drawW) / 2 + offsetX;
  const y = (VIEWPORT - drawH) / 2 + offsetY;
  const ratio = OUTPUT / VIEWPORT;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, OUTPUT, OUTPUT);
  ctx.drawImage(img, x * ratio, y * ratio, drawW * ratio, drawH * ratio);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("encode_failed");
  return new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
}

export function ProfilePhotoModal({ open, busy, currentImageUrl, onClose, onSave }: Props) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef(false);

  const reset = useCallback(() => {
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(null);
    setImgEl(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setErr(null);
    setDone(false);
  }, [sourceUrl]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  async function pickFile(file: File) {
    setErr(null);
    if (!ACCEPT.split(",").some((t) => file.type === t)) {
      setErr("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image must be under 5 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setSourceUrl(url);
      setImgEl(img);
      const fit = Math.max(VIEWPORT / img.width, VIEWPORT / img.height);
      setScale(fit);
      setOffset({ x: 0, y: 0 });
    } catch {
      URL.revokeObjectURL(url);
      setErr("Could not load that image.");
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imgEl) return;
    dragRef.current = true;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setOffset({
      x: dragStart.ox + (e.clientX - dragStart.x),
      y: dragStart.oy + (e.clientY - dragStart.y)
    });
  }

  function onPointerUp() {
    dragRef.current = false;
    setDragging(false);
  }

  const previewStyle =
    imgEl && sourceUrl
      ? {
          width: imgEl.width * scale,
          height: imgEl.height * scale,
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
        }
      : undefined;

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title="Profile photo"
      description="Crop and save — stored through the ServeOS Media Platform (processing, versions, and shared usage)."
      titleId="profile-photo-modal-title"
      busy={busy}
      maxWidthClass="max-w-lg"
      backdropLabel="Close profile photo editor"
    >
      {done ? (
        <>
          <ProfileModalAlert tone="success">Your profile photo was updated.</ProfileModalAlert>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
        </>
      ) : !imgEl ? (
        <>
          <div
            className="admin-profile-photo-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void pickFile(file);
            }}
          >
            {currentImageUrl ? (
              <img src={currentImageUrl} alt="" className="admin-profile-photo-drop-preview" />
            ) : (
              <span className="admin-profile-photo-drop-icon" aria-hidden>
                📷
              </span>
            )}
            <p className="mt-3 text-sm font-semibold text-slate-800">Drop an image here</p>
            <p className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP · max 5 MB</p>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--primary mt-4"
              onClick={() => fileRef.current?.click()}
            >
              Choose image
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickFile(file);
              e.target.value = "";
            }}
          />
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter onCancel={onClose} confirmLabel="Choose image" onConfirm={() => fileRef.current?.click()} />
        </>
      ) : (
        <>
          <div className="admin-profile-photo-editor">
            <div
              className={`admin-profile-photo-viewport ${dragging ? "admin-profile-photo-viewport--dragging" : ""}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {sourceUrl ? (
                <img src={sourceUrl} alt="" className="admin-profile-photo-layer" style={previewStyle} draggable={false} />
              ) : null}
              <div className="admin-profile-photo-mask" aria-hidden />
            </div>
            <div className="admin-profile-photo-preview-ring" aria-hidden>
              {sourceUrl && previewStyle ? (
                <img
                  src={sourceUrl}
                  alt=""
                  className="admin-profile-photo-layer admin-profile-photo-layer--preview"
                  style={{
                    width: previewStyle.width,
                    height: previewStyle.height,
                    transform: `translate(calc(-50% + ${offset.x * 0.45}px), calc(-50% + ${offset.y * 0.45}px)) scale(0.45)`
                  }}
                  draggable={false}
                />
              ) : null}
            </div>
          </div>

          <label className="admin-profile-zoom-label mt-4 block">
            <span className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
              <span>Zoom</span>
              <span className="tabular-nums normal-case text-slate-600">{Math.round(scale * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.4}
              max={3}
              step={0.02}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="admin-profile-zoom-slider w-full"
            />
          </label>

          <p className="mt-2 text-center text-xs text-slate-500">Drag the image to adjust framing</p>

          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}

          <ProfileModalFooter
            onCancel={() => {
              reset();
            }}
            cancelLabel="Choose another"
            confirmLabel="Save photo"
            busy={busy}
            onConfirm={async () => {
              if (!imgEl) return;
              setErr(null);
              try {
                const file = await renderCroppedFile(imgEl, scale, offset.x, offset.y);
                const res = await onSave(file);
                if (!res.ok) {
                  setErr(res.error ?? "Upload failed");
                  return;
                }
                setDone(true);
              } catch {
                setErr("Could not process that image.");
              }
            }}
          />
        </>
      )}
    </ProfileModalShell>
  );
}
