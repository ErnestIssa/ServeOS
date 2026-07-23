import { useMemo } from "react";
import { resolveWorkspacePreset, WORKSPACE_META } from "../adminWorkspaceRouting";
import { AdminConfigMenuPage } from "./AdminConfigMenuPage";
import { AdminConfigPaymentsPage } from "./AdminConfigPaymentsPage";
import { AdminConfigMediaLibraryPage } from "./media/AdminConfigMediaLibraryPage";
import {
  CONFIG_PRESET_DESCRIPTIONS,
  menuTabFromLegacyPreset,
  normalizeConfigPresetId,
  type ConfigPresetId
} from "./configRouting";

type Props = {
  presetId: string;
  venueName?: string;
  token?: string | null;
  restaurantId?: string | null;
};

export function AdminConfigurationPage({
  presetId,
  venueName = "",
  token = null,
  restaurantId = null
}: Props) {
  const configPreset = normalizeConfigPresetId(presetId) as ConfigPresetId;
  const menuInitialTab = useMemo(() => menuTabFromLegacyPreset(presetId), [presetId]);

  const preset = resolveWorkspacePreset("config", configPreset);
  void preset;
  void WORKSPACE_META.config;

  switch (configPreset) {
    case "menu":
      return (
        <AdminConfigMenuPage
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          initialTab={menuInitialTab}
        />
      );
    case "media-library":
      return (
        <AdminConfigMediaLibraryPage
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
        />
      );
    case "payments":
      return <AdminConfigPaymentsPage token={token} restaurantId={restaurantId} />;
    default:
      return (
        <AdminConfigMenuPage
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          initialTab={menuInitialTab}
        />
      );
  }
}

export { CONFIG_PRESET_DESCRIPTIONS };
