import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { MediaLibraryAsset } from "../../../api";

export type MediaCardActionId =
  | "attach"
  | "replace"
  | "create_variant"
  | "duplicate"
  | "move_collection"
  | "copy_link"
  | "download"
  | "archive"
  | "unarchive"
  | "delete"
  | "open_manage";

export type MediaCardActionCaps = {
  canView: boolean;
  canEdit: boolean;
  canUpload: boolean;
  canDelete: boolean;
  /** Share/copy CDN URL — falls back to view until fine-grained media.share exists. */
  canShare: boolean;
};

/**
 * ⋮ quick actions for one MediaAsset — fast, permission-aware, state-aware.
 * Card click opens details; Manage opens the deep workspace.
 */
export function buildMediaCardActions(
  asset: MediaLibraryAsset,
  caps: MediaCardActionCaps
): EntityMenuAction[] {
  const archived = Boolean(asset.archivedAt);
  const processing = asset.processingStatus === "PROCESSING";
  const actions: EntityMenuAction[] = [];

  if (caps.canView) {
    actions.push({ id: "open_manage", label: "Manage" });
  }

  if (caps.canEdit && !archived && !processing) {
    actions.push({ id: "attach", label: "Attach to…" });
  }

  if (caps.canUpload && !archived && !processing) {
    actions.push({ id: "replace", label: "Replace file" });
  }

  if (caps.canUpload && !archived) {
    actions.push({ id: "create_variant", label: "Create variant" });
    actions.push({ id: "duplicate", label: "Duplicate" });
  }

  if (caps.canEdit && !archived) {
    actions.push({ id: "move_collection", label: "Move to collection" });
  }

  if (caps.canShare && asset.url && !archived) {
    actions.push({ id: "copy_link", label: "Copy link" });
  }

  if (caps.canView && asset.url) {
    actions.push({ id: "download", label: "Download" });
  }

  if (caps.canEdit) {
    if (archived) {
      actions.push({ id: "unarchive", label: "Restore from archive" });
    } else if (!processing) {
      actions.push({ id: "archive", label: "Archive" });
    }
  }

  if (caps.canDelete && !processing) {
    actions.push({ id: "delete", label: "Delete", danger: true });
  }

  return actions;
}
