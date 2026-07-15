import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import { listMenuItemMedia, type MenuCapabilitiesPayload, type MenuItemMediaRow } from "../../../api";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "./menuPageModalShell";
import { SkeletonBone } from "../../AdminSkeleton";
import { AdminBtnPrimary } from "../../AdminUi";
import type { MenuSectionTab } from "../configRouting";
import { MenuChip } from "./MenuPageUi";

export type MenuItemDrawerItem = {
  id: string;
  name: string;
  categoryName: string;
  priceCents: number;
  isActive: boolean;
  modifierCount: number;
  description: string | null;
  ingredients: string | null;
  specialNotes: string | null;
};

type Props = {
  item: MenuItemDrawerItem | null;
  open: boolean;
  token: string;
  restaurantId: string;
  limits: MenuCapabilitiesPayload["limits"] | null;
  onClose: () => void;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

const MEDIA_SKELETON_COUNT = 4;

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-menu-readonly-field">
      <p className="admin-menu-readonly-label">{label}</p>
      <p className="admin-menu-readonly-value">{value || "—"}</p>
    </div>
  );
}

function MediaGridSkeleton() {
  return (
    <div className="admin-menu-media-grid admin-menu-item-profile-media-grid mt-3" aria-busy aria-label="Loading item media">
      {Array.from({ length: MEDIA_SKELETON_COUNT }, (_, i) => (
        <div key={i} className="admin-menu-media-card admin-menu-media-card--skeleton">
          <SkeletonBone className="admin-menu-media-card__preview admin-menu-media-card__preview-skeleton" rounded="lg" />
          <SkeletonBone className="h-3 w-16" rounded="sm" />
        </div>
      ))}
    </div>
  );
}

function MediaImagePreview({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="admin-menu-media-card__preview-wrap">
      {!loaded ? <SkeletonBone className="admin-menu-media-card__preview admin-menu-media-card__preview-skeleton" rounded="lg" aria-hidden /> : null}
      <img
        src={src}
        alt={alt}
        className={`admin-menu-media-card__preview${loaded ? "" : " admin-menu-media-card__preview--loading"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function MediaVideoPreview({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="admin-menu-media-card__preview-wrap admin-menu-media-card__preview-wrap--video">
      {!loaded ? <SkeletonBone className="admin-menu-media-card__preview admin-menu-media-card__preview-skeleton admin-menu-media-card__preview-skeleton--video" rounded="lg" aria-hidden /> : null}
      <video
        src={src}
        className={`admin-menu-media-card__preview${loaded ? "" : " admin-menu-media-card__preview--loading"}`}
        controls
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
      />
    </div>
  );
}

export function MenuItemProfileDrawer({
  item,
  open,
  token,
  restaurantId,
  limits,
  onClose,
  onNavigateTab
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeItem, setActiveItem] = useState<MenuItemDrawerItem | null>(null);
  const [media, setMedia] = useState<MenuItemMediaRow[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const closeTimerRef = useRef<number | null>(null);

  const maxImages = limits?.maxImagesPerItem ?? 10;
  const maxVideos = limits?.maxVideosPerItem ?? 3;

  const reloadMedia = useCallback(async () => {
    if (!activeItem) return;
    setMediaLoading(true);
    const res = await listMenuItemMedia(token, restaurantId, activeItem.id);
    setMediaLoading(false);
    if (res.ok && res.media) setMedia(res.media);
    else setMedia([]);
  }, [token, restaurantId, activeItem]);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open && item) {
      setActiveItem(item);
      setMedia([]);
      setMediaLoading(true);
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setActiveItem(null);
      setMedia([]);
      setMediaLoading(true);
      closeTimerRef.current = null;
    }, 520);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, item]);

  useEffect(() => {
    if (open && item) setActiveItem(item);
  }, [open, item]);

  useEffect(() => {
    if (visible && activeItem) void reloadMedia();
  }, [visible, activeItem, reloadMedia]);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!mounted || !activeItem) return null;

  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");

  const goToMediaTab = () => {
    onClose();
    onNavigateTab("images");
  };

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label="Close item profile"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${activeItem.name} details`}
        className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <h3 className="admin-staff-profile-title">{activeItem.name}</h3>
            <p className="admin-staff-profile-sub">{activeItem.categoryName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MenuChip tone={activeItem.isActive ? "success" : "muted"}>{activeItem.isActive ? "Available" : "Hidden"}</MenuChip>
              <span className="admin-staff-profile-meta">{formatMoneyCents(activeItem.priceCents)}</span>
            </div>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body">
          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Basic</h4>
            <div className="admin-staff-meta-grid">
              <ReadonlyRow label="Name" value={activeItem.name} />
              <ReadonlyRow label="Category" value={activeItem.categoryName} />
              <ReadonlyRow label="Base price" value={formatMoneyCents(activeItem.priceCents)} />
              <ReadonlyRow label="Modifiers" value={String(activeItem.modifierCount)} />
            </div>
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Guest-facing copy</h4>
            <div className="space-y-3">
              <ReadonlyRow label="Description" value={activeItem.description?.trim() ?? ""} />
              <ReadonlyRow label="Ingredients" value={activeItem.ingredients?.trim() ?? ""} />
              <ReadonlyRow label="Special notes" value={activeItem.specialNotes?.trim() ?? ""} />
            </div>
          </section>

          <section className="admin-staff-drawer-section admin-menu-item-profile-media-section">
            <h4 className="admin-staff-drawer-section-title">Photos &amp; short videos</h4>
            <p className="admin-staff-drawer-hint">
              View-only preview. To add, remove, or set cover images, use the Menu images tab.
            </p>

            {mediaLoading ? (
              <MediaGridSkeleton />
            ) : media.length === 0 ? (
              <div className="admin-menu-item-profile-media-empty mt-3">
                <p className="admin-staff-profile-muted text-sm">No images or videos yet for this item.</p>
              </div>
            ) : (
              <div className="admin-menu-media-grid admin-menu-item-profile-media-grid mt-3">
                {images.map((row) => (
                  <div key={row.id} className="admin-menu-media-card">
                    {row.url ? (
                      <MediaImagePreview src={row.url} alt={row.originalName ?? activeItem.name} />
                    ) : (
                      <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Image</div>
                    )}
                    <div className="admin-menu-media-card__meta">
                      {row.isCover ? <MenuChip tone="success">Cover</MenuChip> : null}
                      <span className="admin-config-text-subtle text-xs">{row.originalName ?? "Image"}</span>
                    </div>
                  </div>
                ))}
                {videos.map((row) => (
                  <div key={row.id} className="admin-menu-media-card admin-menu-media-card--video">
                    {row.url ? (
                      <MediaVideoPreview src={row.url} />
                    ) : (
                      <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Video</div>
                    )}
                    <div className="admin-menu-media-card__meta">
                      <MenuChip tone="muted">Video</MenuChip>
                      {row.durationMs ? (
                        <span className="admin-config-text-subtle text-xs">{Math.round(row.durationMs / 1000)}s</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="admin-staff-profile-muted mt-3 text-xs">
              Limits: {maxImages} images and {maxVideos} videos per item.
            </p>
            <AdminBtnPrimary className="mt-4 w-full" onClick={goToMediaTab}>
              Manage Media
            </AdminBtnPrimary>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
