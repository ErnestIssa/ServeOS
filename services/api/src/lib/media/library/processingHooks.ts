/**
 * Extension hooks for virus scan / AI.
 * Cloud drives are Import Connectors (copy into ServeOS) — never storage providers.
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
  importSource?: string | null;
}): Promise<ProcessingHookResult> {
  const cloud =
    ctx.importSource === "GOOGLE_DRIVE" ||
    ctx.importSource === "DROPBOX" ||
    ctx.importSource === "ONEDRIVE"
      ? ("done" as const)
      : ("skipped" as const);
  // Virus / AI product scanners stay honest until a real provider ships.
  console.info("[media-platform] post-upload hooks", {
    assetId: ctx.assetId,
    contentType: ctx.contentType,
    restaurantId: ctx.restaurantId,
    cloudImport: cloud
  });
  return {
    virusScan: "skipped",
    ai: "skipped",
    cloudImport: cloud
  };
}

/** Cloud providers are import sources only — files are copied into the Media Platform. */
export const CLOUD_IMPORT_SOURCES = [
  { id: "google_drive", label: "Google Drive", available: true, importSource: "GOOGLE_DRIVE" as const },
  { id: "dropbox", label: "Dropbox", available: true, importSource: "DROPBOX" as const },
  { id: "onedrive", label: "OneDrive", available: true, importSource: "ONEDRIVE" as const }
] as const;
