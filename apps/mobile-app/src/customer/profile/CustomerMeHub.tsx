import React from "react";
import type { AuthUser } from "../../api";
import type { MobileExperienceManifest, MeHubRowManifest, MeHubSectionManifest, ControlCentreChipManifest } from "../../mobile/mobileExperienceTypes";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ProfileAvatarModal } from "./ProfileAvatarModal";
import type { MeNavHighlightKey } from "./profileNavHighlight";
import { loadProfileAvatarUri, saveProfileAvatarUri } from "./profileAvatarStorage";
import { fetchCustomerPreferences } from "../customerAppApi";
import { saveProfileAvatarForCustomer } from "./profilePrefsStorage";
import {
  BlurModalScrim,
  FadeSection,
  ProfileCard,
  ProfileHeader,
  ProfileQuickActionChips,
  ProfileScreenContainer,
  SectionLabel,
  SectionRow
} from "./ProfileUi";

type Props = {
  user: AuthUser | null;
  authToken?: string | null;
  mobileExperience: MobileExperienceManifest;
  venueName: string;
  topInset: number;
  bottomInset: number;
  activeOrderCount: number;
  onNavigateSection: (title: string, subtitle: string | undefined, key: MeNavHighlightKey) => void;
  onNavigateScreen: (screenKey: string, title: string, subtitle?: string) => void;
  onNavigateReview: () => void;
  onOpenBookings: () => void;
  onOpenOrders: () => void;
  onSignOut: () => void;
  onChooseExperience?: () => void;
  onNavigateHelp?: () => void;
  onNavigateSafety?: () => void;
  onNavigateAppSettings?: () => void;
  onAvatarSaved?: (uri: string) => void;
  scrollRefExternal?: React.RefObject<import("react-native").ScrollView | null>;
  scrollEnabled?: boolean;
  onScrollCapture?: (y: number) => void;
};

function rowSubtitle(row: MeHubRowManifest, activeOrderCount: number): string {
  if (row.id === "me:active_orders") {
    return activeOrderCount > 0
      ? `${activeOrderCount} in progress — track live status`
      : "No active orders right now";
  }
  return row.subtitle;
}

/** Help & support rows live under the Help card — never on profile scroll. */
function profileMeHubSections(sections: MeHubSectionManifest[]): MeHubSectionManifest[] {
  return sections
    .filter((section) => section.id !== "help")
    .map((section) => ({
      ...section,
      rows: section.rows.filter(
        (row) => row.action !== "open_support" && row.id !== "me:support" && row.id !== "app:chip:help"
      )
    }))
    .filter((section) => section.rows.length > 0);
}

export function CustomerMeHub(props: Props) {
  const { meHub, controlCentre } = props.mobileExperience;
  const isCustomerExperience = props.mobileExperience.roleType === "CUSTOMER";
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = React.useState(false);

  const visibleSections = React.useMemo(
    () => profileMeHubSections(meHub.sections),
    [meHub.sections]
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      let uri = await loadProfileAvatarUri();
      const tok = props.authToken?.trim();
      if (tok && isCustomerExperience) {
        try {
          const res = await fetchCustomerPreferences(tok);
          if (res.ok && res.avatarUri) {
            uri = res.avatarUri;
            await saveProfileAvatarUri(res.avatarUri);
          }
        } catch {
          /* keep local */
        }
      }
      if (!cancelled) setAvatarUri(uri);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.authToken, isCustomerExperience]);

  const email = props.user?.email?.trim() || "—";

  const onRowPress = React.useCallback(
    (row: MeHubRowManifest) => {
      switch (row.action) {
        case "open_reservations":
          props.onOpenBookings();
          break;
        case "open_orders":
          props.onOpenOrders();
          break;
        case "open_review":
          props.onNavigateReview();
          break;
        case "choose_venue":
          props.onChooseExperience?.();
          break;
        case "navigate_screen":
          if (row.screenKey) {
            props.onNavigateScreen(row.screenKey, row.sectionTitle ?? row.title, row.sectionSubtitle);
          }
          break;
        case "navigate_section":
          props.onNavigateSection(
            row.sectionTitle ?? row.title,
            row.sectionSubtitle,
            row.id as MeNavHighlightKey
          );
          break;
        case "sign_out":
          setSignOutOpen(true);
          break;
      }
    },
    [props]
  );

  const onChipPress = React.useCallback(
    (chip: ControlCentreChipManifest) => {
      switch (chip.action) {
        case "navigate_help":
          props.onNavigateHelp?.();
          break;
        case "navigate_safety":
          props.onNavigateSafety?.();
          break;
        case "navigate_settings":
          props.onNavigateAppSettings?.();
          break;
      }
    },
    [props.onNavigateHelp, props.onNavigateSafety, props.onNavigateAppSettings]
  );

  const showQuickChips =
    controlCentre.chips.length > 0 &&
    Boolean(props.onNavigateHelp && props.onNavigateSafety && props.onNavigateAppSettings);

  return (
    <>
      <ProfileScreenContainer
        topInset={props.topInset}
        bottomInset={props.bottomInset}
        scrollRefExternal={props.scrollRefExternal}
        scrollEnabled={props.scrollEnabled}
        onScrollOffset={props.onScrollCapture}
      >
        <FadeSection>
          <ProfileHeader
            user={props.user}
            venueName={meHub.showVenueLine ? props.venueName : undefined}
            showStreak={props.mobileExperience.roleType === "CUSTOMER"}
            avatarUri={avatarUri}
            onAvatarPress={() => setAvatarOpen(true)}
            onSwitchAccount={props.onChooseExperience}
          />
          {showQuickChips ? (
            <ProfileQuickActionChips chips={controlCentre.chips} onChipPress={onChipPress} />
          ) : null}
        </FadeSection>

        {visibleSections.map((section) => (
          <FadeSection key={section.id}>
            <SectionLabel variant="me">{section.label}</SectionLabel>
            <ProfileCard noPad={section.rows.some((r) => r.action !== "sign_out")}>
              {section.rows.map((row, i) => (
                <SectionRow
                  key={row.id}
                  title={row.title}
                  subtitle={rowSubtitle(row, props.activeOrderCount)}
                  highlightKey={row.danger ? undefined : (row.id as MeNavHighlightKey)}
                  danger={row.danger}
                  last={i === section.rows.length - 1}
                  noHighlight={row.danger}
                  onPress={() => onRowPress(row)}
                />
              ))}
            </ProfileCard>
          </FadeSection>
        ))}
      </ProfileScreenContainer>

      <ProfileAvatarModal
        visible={avatarOpen}
        uri={avatarUri}
        onClose={() => setAvatarOpen(false)}
        onSaved={(uri) => {
          setAvatarUri(uri);
          void saveProfileAvatarUri(uri);
          if (isCustomerExperience) void saveProfileAvatarForCustomer(uri, props.authToken);
          props.onAvatarSaved?.(uri);
        }}
      />

      <BlurModalScrim
        visible={signOutOpen}
        title="Log out?"
        body={`${email}\n\nYou can sign back in with the same account.`}
        primaryLabel="Log out"
        primaryDanger
        onPrimary={() => {
          setSignOutOpen(false);
          props.onSignOut();
        }}
        secondaryLabel="Cancel"
        onSecondary={() => setSignOutOpen(false)}
      />
    </>
  );
}
