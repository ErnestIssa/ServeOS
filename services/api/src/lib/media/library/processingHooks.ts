/**
 * Extension hooks for future virus scan / AI / cloud import.
 * V1 always returns skipped — never invent capabilities.
 */

export type ProcessingHookResult = {
  virusScan: "skipped" | "clean" | "blocked";
  ai: "skipped" | "done";
  cloudImport: "skipped" | "done";
};

export async function runPostUploadHooks(_ctx: {
  assetId: string;
  objectKey: string;
  contentType: string;
  restaurantId: string;
}): Promise<ProcessingHookResult> {
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
