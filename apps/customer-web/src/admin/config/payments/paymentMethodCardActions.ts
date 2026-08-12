import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { PaymentMethodListRow } from "./paymentMethodsListQuery";

export type PaymentMethodCardActionId =
  | "manage"
  | "setup"
  | "enable"
  | "disable"
  | "set_default"
  | "test"
  | "view_activity"
  | "view_reconciliation"
  | "duplicate"
  | "view_audit";

/** True when backend readiness says setup is incomplete (or readiness is missing). */
export function methodNeedsSetup(row: PaymentMethodListRow): boolean {
  if (row.enabled) return false;
  if (!row.readiness) return true;
  return row.canEnable !== true;
}

/** Manage/edit is only for methods that have progressed past blank setup. */
export function methodAllowsManage(row: PaymentMethodListRow): boolean {
  if (row.enabled) return true;
  const status = row.readiness?.status;
  if (!status) return false;
  return status !== "SETUP_REQUIRED" && status !== "NOT_CONFIGURED";
}

export function buildPaymentMethodCardActions(
  row: PaymentMethodListRow,
  caps: { canEdit: boolean }
): EntityMenuAction[] {
  const actions: EntityMenuAction[] = [];
  const needsSetup = methodNeedsSetup(row);
  const canManage = methodAllowsManage(row);

  if (needsSetup || !canManage) {
    actions.push({ id: "setup", label: needsSetup ? "Set up" : "Continue setup" });
  } else {
    actions.push({ id: "manage", label: "Manage" });
  }

  if (caps.canEdit) {
    if (row.enabled) {
      actions.push({ id: "disable", label: "Disable", danger: true });
      if (!row.isDefault) {
        actions.push({ id: "set_default", label: "Set as default" });
      }
    } else if (row.canEnable === true) {
      actions.push({ id: "enable", label: "Enable" });
    } else if (!needsSetup) {
      actions.push({ id: "setup", label: "Continue setup" });
    }
  }

  if (row.enabled) {
    actions.push({ id: "test", label: "Test" });
    actions.push({ id: "view_activity", label: "View activity", external: true });
    actions.push({ id: "view_reconciliation", label: "View reconciliation", external: true });
    if (caps.canEdit) {
      actions.push({ id: "duplicate", label: "Duplicate configuration" });
    }
  }

  if (canManage || row.enabled) {
    actions.push({ id: "view_audit", label: "View audit history" });
  }

  return actions;
}
