import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { RefundListRow } from "./refundsListQuery";

export type RefundCardActionId =
  | "view"
  | "preview_receipt"
  | "email_receipt"
  | "print_receipt"
  | "approve"
  | "decline"
  | "retry"
  | "refund_remaining"
  | "mark_cash_returned"
  | "cancel_processing"
  | "copy_id"
  | "copy_order_id"
  | "copy_payment_id"
  | "copy_swish_ref"
  | "copy_klarna_ref"
  | "refresh_status";

export function buildRefundCardActions(
  row: RefundListRow,
  caps: { canEdit: boolean }
): EntityMenuAction[] {
  const actions: EntityMenuAction[] = [{ id: "view", label: "View details" }];
  const cardLike = ["visa", "mastercard", "amex", "card", "applePay", "googlePay", "samsungPay", "cardTerminal"].includes(
    row.methodKey
  );
  const swish = row.methodKey === "swish" || row.methodKey === "swishAtVenue";
  const klarna = row.methodKey.startsWith("klarna");
  const cash = row.methodKey === "cash";
  const settled = row.status === "completed" || row.status === "partially_refunded";

  if (settled || row.status === "processing") {
    actions.push({ id: "preview_receipt", label: "Preview receipt" });
  } else {
    actions.push({ id: "preview_receipt", label: "Preview original receipt" });
  }

  if (row.status === "pending_approval" && caps.canEdit) {
    actions.push({ id: "approve", label: cash ? "Approve cash return" : "Approve refund" });
    actions.push({ id: "decline", label: "Decline refund", danger: true });
  }

  if (row.status === "processing") {
    actions.push({ id: "refresh_status", label: swish ? "Refresh Swish status" : "Refresh status" });
    if (caps.canEdit) {
      actions.push({ id: "cancel_processing", label: "Cancel in-progress refund", danger: true });
    }
  }

  if (row.status === "failed" && caps.canEdit) {
    actions.push({ id: "retry", label: cash ? "Retry as manual refund" : "Retry refund" });
  }

  if (row.status === "partially_refunded" && caps.canEdit && !cash) {
    actions.push({ id: "refund_remaining", label: "Refund remaining" });
  }

  if (cash && caps.canEdit && (row.status === "pending_approval" || row.status === "processing")) {
    actions.push({ id: "mark_cash_returned", label: "Mark cash returned" });
  }

  if (settled) {
    actions.push({ id: "email_receipt", label: "Email receipt to guest" });
    if (cardLike || cash || klarna) {
      actions.push({ id: "print_receipt", label: "Print receipt" });
    }
  }

  if (swish) {
    actions.push({ id: "copy_swish_ref", label: "Copy Swish reference" });
  }
  if (klarna) {
    actions.push({ id: "copy_klarna_ref", label: "Copy Klarna reference" });
  }
  if (row.orderId) {
    actions.push({ id: "copy_order_id", label: "Copy order ID" });
  }
  actions.push({ id: "copy_payment_id", label: "Copy payment ID" });
  actions.push({ id: "copy_id", label: "Copy refund ID" });
  return actions;
}
