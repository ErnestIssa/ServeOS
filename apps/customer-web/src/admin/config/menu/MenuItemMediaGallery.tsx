import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachMenuItemMedia,
  completeMenuMediaUpload,
  createMenuMediaUploadSession,
  listMenuItemMedia,
  removeMenuItemMedia,
  uploadMenuMediaBase64,
  type MenuCapabilitiesPayload,
  type MenuItemMediaRow
} from "../../../api";
import { AdminBtnSecondary } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { MenuChip, MenuSection, MenuToolbarButton } from "./MenuPageUi";

type Props = {
  token: string;
  restaurantId: string;
  menuItemId: string;
  itemName: string;
  canUpload: boolean;
  canRemove: boolean;
  limits: MenuCapabilitiesPayload["limits"] | null;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

function readVideoDurationMs(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const ms = Math.round(video.duration * 1000);
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video_metadata_failed"));
    };
    video.src = url;
  });
}

async function uploadMenuItemFile(
  token: string,
  restaurantId: string,
  menuItemId: string,
  file: File,
  kind: "image" | "video"
) {
  const scope = kind === "image" ? "menu" : "video";
  const contentType = file.type || (kind === "image" ? "image/jpeg" : "video/mp4");
  const session = await createMenuMediaUploadSession(token, {
    scope,
    contentType,
    restaurantId,
    menuItemId,
    originalName: file.name
  });
  if (!session.ok || !session.upload) {
    return { ok: false as const, error: session.error ?? "upload_session_failed" };
  }

  const dataBase64 = await readFileAsDataUrl(file);
  const uploaded = await uploadMenuMediaBase64(token, {
    scope,
    objectKey: session.upload.objectKey,
    contentType,
    dataBase64,
    restaurantId,
    originalName: file.name
  });
  if (!uploaded.ok || !uploaded.media?.id) {
    const completed = await completeMenuMediaUpload(token, {
      scope,
      objectKey: session.upload.objectKey,
      contentType,
      restaurantId,
      originalName: file.name
    });
    if (!completed.ok || !completed.media?.id) {
      return { ok: false as const, error: uploaded.error ?? completed.error ?? "upload_failed" };
    }
    return { ok: true as const, mediaId: completed.media.id };
  }
  return { ok: true as const, mediaId: uploaded.media.id };
}

export function MenuItemMediaGallery({
  token,
  restaurantId,
  menuItemId,
  itemName,
  canUpload,
  canRemove,
  limits
}: Props) {
  const { pushToast } = useAdminToast();
  const [media, setMedia] = useState<MenuItemMediaRow[]>([]);
  const [counts, setCounts] = useState({ images: 0, videos: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const maxImages = limits?.maxImagesPerItem ?? 10;
  const maxVideos = limits?.maxVideosPerItem ?? 3;
  const maxVideoMs = limits?.maxVideoDurationMs ?? 60_000;

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await listMenuItemMedia(token, restaurantId, menuItemId);
    setLoading(false);
    if (!res.ok || !res.media) {
      pushToast(res.message ?? res.error ?? "Could not load item media", "error");
      return;
    }
    setMedia(res.media);
    setCounts(res.counts ?? { images: 0, videos: 0 });
  }, [token, restaurantId, menuItemId, pushToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleUpload = async (file: File, kind: "image" | "video") => {
    if (!canUpload) return pushToast("You do not have permission to upload menu media.", "error");
    if (kind === "image" && counts.images >= maxImages) {
      return pushToast(`This item already has ${maxImages} images.`, "error");
    }
    if (kind === "video" && counts.videos >= maxVideos) {
      return pushToast(`This item already has ${maxVideos} videos.`, "error");
    }

    let durationMs: number | undefined;
    if (kind === "video") {
      try {
        durationMs = await readVideoDurationMs(file);
        if (durationMs > maxVideoMs) {
          return pushToast("Videos must be 60 seconds or shorter.", "error");
        }
      } catch {
        return pushToast("Could not read video duration.", "error");
      }
    }

    setBusy(true);
    const uploaded = await uploadMenuItemFile(token, restaurantId, menuItemId, file, kind);
    if (!uploaded.ok) {
      setBusy(false);
      return pushToast(uploaded.error ?? "Upload failed", "error");
    }

    const attached = await attachMenuItemMedia(token, restaurantId, menuItemId, {
      mediaId: uploaded.mediaId,
      setAsCover: kind === "image" && counts.images === 0,
      durationMs
    });
    setBusy(false);
    if (!attached.ok) {
      return pushToast(attached.message ?? attached.error ?? "Could not attach media", "error");
    }
    pushToast(kind === "image" ? "Image added to item." : "Video added to item.", "success");
    void reload();
  };

  const handleRemove = async (row: MenuItemMediaRow) => {
    if (!canRemove) return pushToast("You do not have permission to remove menu media.", "error");
    setBusy(true);
    const res = await removeMenuItemMedia(token, restaurantId, menuItemId, row.id);
    setBusy(false);
    if (!res.ok) return pushToast(res.message ?? res.error ?? "Remove failed", "error");
    pushToast("Media removed.", "success");
    void reload();
  };

  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");

  return (
    <MenuSection
      title="Photos & short videos"
      description={`Up to ${maxImages} images and ${maxVideos} short videos (≤60s) per item. Media is stored securely and served through the API.`}
    >
      <div className="admin-menu-media-toolbar">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleUpload(file, "image");
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleUpload(file, "video");
          }}
        />
        <MenuToolbarButton
          primary
          disabled={busy || !canUpload || counts.images >= maxImages}
          onClick={() => imageInputRef.current?.click()}
        >
          Add image ({counts.images}/{maxImages})
        </MenuToolbarButton>
        <MenuToolbarButton
          disabled={busy || !canUpload || counts.videos >= maxVideos}
          onClick={() => videoInputRef.current?.click()}
        >
          Add video ({counts.videos}/{maxVideos})
        </MenuToolbarButton>
        <AdminBtnSecondary disabled={busy || loading} onClick={() => void reload()}>
          Refresh
        </AdminBtnSecondary>
      </div>

      {loading ? (
        <p className="admin-config-text-subtle mt-4 text-sm">Loading media for {itemName}…</p>
      ) : media.length === 0 ? (
        <div className="admin-menu-image-placeholder mt-4">
          <p className="admin-config-text-subtle text-sm">No images or videos yet for {itemName}.</p>
        </div>
      ) : (
        <div className="admin-menu-media-grid mt-4">
          {images.map((row) => (
            <div key={row.id} className="admin-menu-media-card">
              {row.url ? (
                <img src={row.url} alt={row.originalName ?? itemName} className="admin-menu-media-card__preview" />
              ) : (
                <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Image</div>
              )}
              <div className="admin-menu-media-card__meta">
                {row.isCover ? <MenuChip tone="success">Cover</MenuChip> : null}
                <span className="admin-config-text-subtle text-xs">{row.originalName ?? "Image"}</span>
              </div>
              {canRemove ? (
                <button
                  type="button"
                  className="admin-menu-media-card__remove"
                  disabled={busy}
                  onClick={() => void handleRemove(row)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {videos.map((row) => (
            <div key={row.id} className="admin-menu-media-card admin-menu-media-card--video">
              {row.url ? (
                <video src={row.url} className="admin-menu-media-card__preview" controls preload="metadata" />
              ) : (
                <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Video</div>
              )}
              <div className="admin-menu-media-card__meta">
                <MenuChip tone="muted">Video</MenuChip>
                {row.durationMs ? (
                  <span className="admin-config-text-subtle text-xs">{Math.round(row.durationMs / 1000)}s</span>
                ) : null}
              </div>
              {canRemove ? (
                <button
                  type="button"
                  className="admin-menu-media-card__remove"
                  disabled={busy}
                  onClick={() => void handleRemove(row)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </MenuSection>
  );
}
