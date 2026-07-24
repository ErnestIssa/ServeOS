import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";

export type MediaAttachTargetChoice =
  | "VENUE_LOGO"
  | "VENUE_COVER"
  | "MENU_COVER"
  | "MENU_ITEM"
  | "CATEGORY"
  | "STAFF_AVATAR"
  | "MARKETING_CAMPAIGN"
  | "LOYALTY_REWARD";

type Props = {
  open: boolean;
  assetName: string;
  canEdit: boolean;
  onClose: () => void;
  onAttachVenue: (role: "VENUE_LOGO" | "VENUE_COVER") => void;
  onPickDeferred: (target: MediaAttachTargetChoice) => void;
};

const DEFERRED: Array<{ id: MediaAttachTargetChoice; label: string; description: string }> = [
  { id: "MENU_COVER", label: "Menu cover", description: "Pick a menu in the Menu workspace" },
  { id: "MENU_ITEM", label: "Menu item", description: "Attach from the item gallery" },
  { id: "CATEGORY", label: "Category", description: "Attach from category settings" },
  { id: "STAFF_AVATAR", label: "Staff avatar", description: "Available from staff profiles" },
  { id: "MARKETING_CAMPAIGN", label: "Promotion", description: "Marketing surfaces — coming soon" },
  { id: "LOYALTY_REWARD", label: "Loyalty campaign", description: "Loyalty surfaces — coming soon" }
];

/**
 * Quick attach picker — venue targets attach immediately; others route via backend-ready types.
 */
export function MediaAttachQuickModal({
  open,
  assetName,
  canEdit,
  onClose,
  onAttachVenue,
  onPickDeferred
}: Props) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Attach to…"
      description={`Attach “${assetName}” without leaving the Media Library. Available targets come from the Media Platform.`}
      titleId="media-attach-quick"
      maxWidthClass="max-w-md"
      bodyScroll={false}
    >
      <div className="admin-menu-manage-actions">
        <button
          type="button"
          className="admin-menu-manage-action"
          disabled={!canEdit}
          onClick={() => onAttachVenue("VENUE_LOGO")}
        >
          <span className="admin-menu-manage-action-label">Restaurant logo</span>
          <span className="admin-menu-manage-action-desc">Venue profile · primary brand mark</span>
        </button>
        <button
          type="button"
          className="admin-menu-manage-action"
          disabled={!canEdit}
          onClick={() => onAttachVenue("VENUE_COVER")}
        >
          <span className="admin-menu-manage-action-label">Restaurant cover</span>
          <span className="admin-menu-manage-action-desc">Venue profile · cover image</span>
        </button>
        {DEFERRED.map((t) => (
          <button
            key={t.id}
            type="button"
            className="admin-menu-manage-action"
            onClick={() => onPickDeferred(t.id)}
          >
            <span className="admin-menu-manage-action-label">{t.label}</span>
            <span className="admin-menu-manage-action-desc">{t.description}</span>
          </button>
        ))}
      </div>
      <ProfileModalFooter cancelLabel="Close" onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
