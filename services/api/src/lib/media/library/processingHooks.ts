/**
 * Extension hooks for future virus scan / AI / cloud import.
 * Media Platform always returns skipped for product scanners until a real provider ships.
 */

export type ProcessingHookResult = {
  virusScan: "skipped" | "clean" | "blocked";
  ai: "skipped" | "done";
  cloudImport: "skipped" | "done";
};

export async function runPostUploadHooks(ctx: {
  assetId: string;
  objectKey: string;
  contentType: string;
  restaurantId: string;
}): Promise<ProcessingHookResult> {
  // Intentionally no-op product features — do not invent virus/AI results.
  console.info("[media-platform] post-upload hooks skipped", {
    assetId: ctx.assetId,
    contentType: ctx.contentType,
    restaurantId: ctx.restaurantId
  });
  return {
    virusScan: "skipped",
    ai: "skipped",
    cloudImport: "skipped"
  };
}

export const CLOUD_IMPORT_SOURCES = [
  { id: "google_drive", label: "Google Drive", available: false },
  { id: "dropbox", label: "Dropbox", available: false },
  { id: "onedrive", label: "OneDrive", available: false }
] as const;
