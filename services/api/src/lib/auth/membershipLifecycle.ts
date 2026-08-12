export const MEMBERSHIP_RECOVERY_DAYS = 30;

export function membershipRecoveryCutoff(): Date {
  return new Date(Date.now() - MEMBERSHIP_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
}
