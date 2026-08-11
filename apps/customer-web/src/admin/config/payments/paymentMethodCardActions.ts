import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { PaymentMethodListRow } from "./paymentMethodsListQuery";

export type PaymentMethodCardActionId =
  | "manage"
  | "enable"
  | "disable"
  | "set_default"
  | "test"
  | "view_activity"
  | "view_reconciliation"
  | "duplicate"
  | "view_audit";

export function buildPaymentMethodCardActions(
  row: PaymentMethodListRow,
  caps: { canEdit: boolean }
): EntityMenuAction[] {
  const actions: EntityMenuAction[] = [{ id: "manage", label: "Manage" }];

  if (caps.canEdit) {
    actions.push({
      id: row.enabled ? "disable" : "enable",
      label: row.enabled ? "Disable" : "Enable",
      danger: row.enabled
    });
    if (row.enabled && !row.isDefault) {
      actions.push({ id: "set_default", label: "Set as default" });
    }
  }

  actions.push({ id: "test", label: "Test" });
  actions.push({ id: "view_activity", label: "View activity", external: true });
  actions.push({ id: "view_reconciliation", label: "View reconciliation", external: true });

  if (caps.canEdit) {
    actions.push({ id: "duplicate", label: "Duplicate configuration" });
  }

  actions.push({ id: "view_audit", label: "View audit history" });
  return actions;
}
