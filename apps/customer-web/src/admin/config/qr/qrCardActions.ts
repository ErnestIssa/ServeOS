import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { QrCodeRow } from "../../../api";
import { isUiOnlyQrId } from "./qrListUiMocks";

/**
 * Card ⋮ quick actions — day-to-day speed only.
 * Destination, ordering rules, edit, analytics, downloads, and status ops live in QrManageDrawer.
 */
export type QrCardActionId =
  | "view_details"
  | "preview_guest"
  | "test_scan"
  | "copy_link"
  | "print_qr"
  | "activate"
  | "duplicate"
  | "manage"
  | "unarchive"
  | "delete";

export type QrCardActionCaps = {
  canView: boolean;
  canManage: boolean;
};

export function buildQrCardActions(row: QrCodeRow, caps: QrCardActionCaps): EntityMenuAction[] {
  const uiOnly = isUiOnlyQrId(row.id);
  const actions: EntityMenuAction[] = [];

  if (caps.canView) {
    actions.push({ id: "view_details", label: "Details" });
    actions.push({ id: "preview_guest", label: "QR Destination", external: true });
    actions.push({ id: "test_scan", label: "Test scan", external: true });
    actions.push({ id: "copy_link", label: "Copy QR link" });
    // Opens confirm modal (download or device print) — not a direct external jump.
    actions.push({ id: "print_qr", label: "Print QR" });
  }

  if (caps.canManage && !uiOnly && row.status === "INACTIVE") {
    actions.push({ id: "activate", label: "Activate" });
  }

  if (caps.canManage && !uiOnly) {
    actions.push({ id: "duplicate", label: "Duplicate" });
  }

  if (caps.canView) {
    actions.push({ id: "manage", label: "Manage" });
  }

  return actions;
}

/** Archived list — restore or permanently delete only. */
export function buildQrArchivedCardActions(caps: QrCardActionCaps): EntityMenuAction[] {
  if (!caps.canManage) return [];
  return [
    { id: "unarchive", label: "Unarchive" },
    { id: "delete", label: "Delete", danger: true }
  ];
}
