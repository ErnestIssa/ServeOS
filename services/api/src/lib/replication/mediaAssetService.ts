/**
 * Compatibility shim — Media Library domain lives in lib/media/library.
 * Replication and older imports keep working via re-exports.
 */
export {
  ensureAssetFromUpload,
  attachUsage,
  detachUsage,
  assetUsageCount,
  deleteAssetIfUnused,
  duplicateUsage,
  listVenueAssets,
  syncAssetFromStoredMedia,
  cloneItemMediaViaAssets,
  type EnsureAssetInput
} from "../media/library/assetService.js";
