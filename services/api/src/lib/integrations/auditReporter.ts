/** Sentry audit bridge — security SSOT remains PostgreSQL. */
import { captureSecurityAudit as sentryCaptureSecurityAudit } from "./sentry.js";

export function captureSecurityAudit(event: {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  sentryCaptureSecurityAudit(event);
}
