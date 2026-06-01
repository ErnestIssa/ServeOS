/** Format milliseconds until visit for the countdown ring center label. */
export function formatCountdownRemaining(ms: number): string {
  if (ms <= 0) return "Now";
  const totalSec = Math.ceil(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (mins > 0) {
    return secs > 0 && mins < 10 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${secs}s`;
}

export function countdownProgress(msRemaining: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  const clamped = Math.max(0, Math.min(msRemaining, totalMs));
  return clamped / totalMs;
}
