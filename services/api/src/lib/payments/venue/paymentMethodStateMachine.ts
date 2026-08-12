/**
 * Internal lifecycle is the SSOT. Admin badges are a derived projection only.
 */
export type PaymentMethodLifecycleStatus =
  | "NOT_CONFIGURED"
  | "SETUP_REQUIRED"
  | "CONFIGURING"
  | "SUBMITTED"
  | "PENDING_VERIFICATION"
  | "VERIFYING"
  | "READY"
  | "ENABLED"
  | "DISABLED"
  | "DEGRADED"
  | "FAILED"
  | "REVOKED"
  | "ERROR";

/** UI badge tokens used by the Methods list (never used as internal SSOT). */
export type PaymentMethodUiHealth =
  | "active"
  | "inactive"
  | "pending"
  | "issue"
  | "setup"
  | "ready"
  | "disconnected";

export type PaymentMethodNextAction =
  | "SET_UP"
  | "CONTINUE_SETUP"
  | "CONNECT_ADAPTER"
  | "VERIFY_CONNECTION"
  | "CONFIGURE_CHANNELS"
  | "ACTIVATE"
  | "FIX_ISSUE"
  | "DISABLE"
  | "RECONNECT"
  | "NONE";

export function mapLifecycleToUiHealth(
  status: PaymentMethodLifecycleStatus,
  isDefault: boolean
): { health: PaymentMethodUiHealth; statusLabel: string } {
  switch (status) {
    case "ENABLED":
      return { health: "active", statusLabel: isDefault ? "Default" : "Active" };
    case "READY":
      return { health: "ready", statusLabel: "Ready to enable" };
    case "SETUP_REQUIRED":
    case "NOT_CONFIGURED":
      return { health: "setup", statusLabel: "Set up" };
    case "CONFIGURING":
    case "SUBMITTED":
      return { health: "pending", statusLabel: "In progress" };
    case "PENDING_VERIFICATION":
    case "VERIFYING":
      return { health: "pending", statusLabel: "Pending" };
    case "DEGRADED":
    case "FAILED":
    case "ERROR":
      return { health: "issue", statusLabel: "Issue" };
    case "REVOKED":
      return { health: "disconnected", statusLabel: "Disconnected" };
    case "DISABLED":
    default:
      return { health: "inactive", statusLabel: "Off" };
  }
}

export function canEnableFromStatus(status: PaymentMethodLifecycleStatus): boolean {
  return status === "READY" || status === "ENABLED";
}

export function canDisableFromStatus(status: PaymentMethodLifecycleStatus): boolean {
  return (
    status === "ENABLED" ||
    status === "DEGRADED" ||
    status === "ERROR" ||
    status === "FAILED" ||
    status === "PENDING_VERIFICATION"
  );
}

/** Disable blocks NEW attempts; never deletes connection or pending resolution. */
export type PaymentMethodDisablePolicy = {
  blockNewAttempts: true;
  preservePendingIntents: true;
  preserveWebhooks: true;
  preserveRefunds: true;
  preserveHistory: true;
};

export const METHOD_DISABLE_POLICY: PaymentMethodDisablePolicy = {
  blockNewAttempts: true,
  preservePendingIntents: true,
  preserveWebhooks: true,
  preserveRefunds: true,
  preserveHistory: true
};
