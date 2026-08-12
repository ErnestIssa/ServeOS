export type PaymentPermission =
  | "payment.view"
  | "payment.configure"
  | "payment.connect_provider"
  | "payment.enable_method"
  | "payment.disable_method"
  | "payment.set_default"
  | "payment.refund"
  | "payment.manual_payment"
  | "payment.reconcile"
  | "payment.view_sensitive_logs"
  | "payment.rotate_credentials"
  | "payment.disconnect_provider";

const ROLE_GRANTS: Record<string, PaymentPermission[]> = {
  owner: [
    "payment.view",
    "payment.configure",
    "payment.connect_provider",
    "payment.enable_method",
    "payment.disable_method",
    "payment.set_default",
    "payment.refund",
    "payment.manual_payment",
    "payment.reconcile",
    "payment.view_sensitive_logs",
    "payment.rotate_credentials",
    "payment.disconnect_provider"
  ],
  manager: [
    "payment.view",
    "payment.configure",
    "payment.enable_method",
    "payment.disable_method",
    "payment.set_default",
    "payment.refund",
    "payment.manual_payment",
    "payment.reconcile"
  ],
  staff: ["payment.view", "payment.manual_payment"]
};

export function hasPaymentPermission(
  role: string | undefined | null,
  permission: PaymentPermission,
  explicit?: string[] | null
): boolean {
  if (explicit?.includes(permission)) return true;
  const grants = ROLE_GRANTS[role ?? ""] ?? [];
  return grants.includes(permission);
}

export function assertPaymentPermission(
  role: string | undefined | null,
  permission: PaymentPermission,
  explicit?: string[] | null
) {
  if (!hasPaymentPermission(role, permission, explicit)) {
    throw Object.assign(new Error("payment_permission_denied"), {
      statusCode: 403,
      code: "payment_permission_denied",
      permission
    });
  }
}
