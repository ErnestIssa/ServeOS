import { defaultPermissionsForRole, VENUE_PERMISSION } from "../venue/venuePermissionKeys";

export function canEditPayments(role: string, permissions = defaultPermissionsForRole(role)) {
  const r = role.trim().toUpperCase();
  if (r === "OWNER" || r === "MANAGER") return true;
  return permissions.includes(VENUE_PERMISSION.paymentSettings);
}

export function paymentsEditReason(role: string) {
  if (canEditPayments(role)) return null;
  return "You need Payment settings permission or a manager/owner role to change payment configuration.";
}
