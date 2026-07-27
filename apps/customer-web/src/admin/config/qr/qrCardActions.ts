import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { QrCodeRow } from "../../../api";
import { isUiOnlyQrId } from "./qrListUiMocks";

/**
 * Card ⋮ quick actions — speed-first (preview, print, copy, status).
 * Destructive config (rotate / deep edit / delete) lives in QrManageDrawer.
 */
export type QrCardActionId =
  | "view_details"
  | "preview_guest"
  | "open_destination"
  | "test_scan"
  | "view_ordering_rules"
  | "download_png"
  | "download_svg"
  | "copy_link"
  | "copy_public_code"
  | "print_qr"
  | "activate"
  | "deactivate"
  | "pause_ordering"
  | "resume_ordering"
  | "edit_qr"
  | "duplicate"
  | "view_analytics"
  | "view_activity"
  | "open_manager"
  | "archive";

export type QrCardActionCaps = {
  canView: boolean;
  canManage: boolean;
};

/**
 * Card ⋮ = speed-first. Rotate / deep config / delete stay in QrManageDrawer.
 * Order mirrors product groups: Open → Ordering → QR → Status → Edit → Analytics → More.
 */
export function buildQrCardActions(row: QrCodeRow, caps: QrCardActionCaps): EntityMenuAction[] {
  const uiOnly = isUiOnlyQrId(row.id);
  const actions: EntityMenuAction[] = [];

  if (caps.canView) {
    // Open
    actions.push({ id: "view_details", label: "View details" });
    // Ordering
    actions.push({ id: "preview_guest", label: "Preview guest experience" });
    actions.push({ id: "open_destination", label: "Open destination" });
    actions.push({ id: "test_scan", label: "Test scan" });
    actions.push({ id: "view_ordering_rules", label: "View current ordering rules" });
    // QR assets
    actions.push({ id: "download_png", label: "Download PNG" });
    actions.push({ id: "download_svg", label: "Download SVG" });
    actions.push({ id: "copy_link", label: "Copy guest link" });
    actions.push({ id: "copy_public_code", label: "Copy public code" });
    actions.push({ id: "print_qr", label: "Print QR" });
  }

  // Status (live ops — still quick, not rotate/delete)
  if (caps.canManage && !uiOnly) {
    if (row.status === "INACTIVE") actions.push({ id: "activate", label: "Activate" });
    if (row.status === "ACTIVE") actions.push({ id: "deactivate", label: "Deactivate" });
    if (row.status === "ACTIVE" && !row.orderingPaused) {
      actions.push({ id: "pause_ordering", label: "Pause ordering" });
    }
    if (row.status === "ACTIVE" && row.orderingPaused) {
      actions.push({ id: "resume_ordering", label: "Resume ordering" });
    }
  }

  // Edit (opens Manage for config; duplicate is safe clone)
  if (caps.canManage) {
    actions.push({ id: "edit_qr", label: "Edit QR" });
    if (!uiOnly) actions.push({ id: "duplicate", label: "Duplicate" });
  }

  if (caps.canView) {
    // Analytics + More
    actions.push({ id: "view_analytics", label: "View analytics" });
    actions.push({ id: "view_activity", label: "View activity log" });
    actions.push({ id: "open_manager", label: "Open in QR Manager" });
  }

  if (caps.canManage && !uiOnly && row.status !== "ARCHIVED" && row.status !== "ROTATED") {
    actions.push({ id: "archive", label: "Archive", danger: true });
  }

  return actions;
}
