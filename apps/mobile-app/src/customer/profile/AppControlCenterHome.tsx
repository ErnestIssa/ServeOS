import React from "react";
import type { AuthUser } from "../../api";
import type { MobileExperienceManifest } from "../../mobile/mobileExperienceTypes";
import type { AppNavHighlightKey } from "./profileNavHighlight";
import { AppControlCenterBody } from "./AppControlCenterBody";
import { ProfileScreenContainer } from "./ProfileUi";

type Props = {
  user: AuthUser | null;
  authToken?: string | null;
  mobileExperience: MobileExperienceManifest;
  topInset: number;
  bottomInset: number;
  chromeTopBleed: number;
  onScrollEdges?: (edges: { atTop: boolean; atBottom: boolean }) => void;
  onNavigateHelp: () => void;
  onNavigateSafety: () => void;
  onNavigateAppSettings: () => void;
  onNavigateSection: (title: string, subtitle: string | undefined, key: AppNavHighlightKey) => void;
  onNavigateScreen: (screenKey: string, title: string, subtitle?: string) => void;
  onChooseVenue: () => void;
};

/** Standalone scroll host — prefer `MeHubMoreSection` on the profile tab. */
export function AppControlCenterHome(props: Props) {
  const {
    topInset,
    bottomInset,
    chromeTopBleed,
    onScrollEdges,
    user,
    authToken,
    mobileExperience,
    ...bodyProps
  } = props;

  return (
    <ProfileScreenContainer
      topInset={topInset}
      bottomInset={bottomInset}
      frostedScrollEdges
      frostedTopBleed={chromeTopBleed}
      frostedExternalTopChrome
      onScrollEdges={onScrollEdges}
    >
      <AppControlCenterBody
        user={user}
        authToken={authToken}
        mobileExperience={mobileExperience}
        {...bodyProps}
      />
    </ProfileScreenContainer>
  );
}
