import { useCallback, useEffect, useState } from "react";
import { listMenuItemMedia, removeMenuItemMedia, type MenuCapabilitiesPayload, type MenuItemMediaRow } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MediaPickerModal } from "../media/MediaPickerModal";
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const maxImages = limits?.maxImagesPerItem ?? 10;
  const maxVideos = limits?.maxVideosPerItem ?? 3;

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
  const atLimit = counts.images >= maxImages && counts.videos >= maxVideos;

  return (
    <MenuSection
      title="Photos & short videos"
      description={`All media goes through the ServeOS Media Platform. Up to ${maxImages} images and ${maxVideos} short videos (≤60s) per item.`}
    >
      <div className="admin-menu-media-toolbar">
        <MenuToolbarButton
          primary
          disabled={busy || !canUpload || atLimit}
          onClick={() => setPickerOpen(true)}
        >
          Choose media
        </MenuToolbarButton>
        <span className="admin-config-text-subtle text-xs">
          {counts.images}/{maxImages} images · {counts.videos}/{maxVideos} videos
        </span>
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
            <div key={row.id} className="admin-menu-media-card">
              <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Video</div>
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

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        token={token}
        restaurantId={restaurantId}
        canUpload={canUpload}
        menus={[]}
        items={[{ id: menuItemId, name: itemName, categoryName: "" }]}
        attachTarget={{ targetType: "MENU_ITEM", targetId: menuItemId }}
        onAttached={() => {
          pushToast("Library media attached.", "success");
          void reload();
        }}
      />
    </MenuSection>
  );
}
