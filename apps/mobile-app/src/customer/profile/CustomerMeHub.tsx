import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AuthUser } from "../../api";
import { ThemedSwitch } from "../../components/ThemedSwitch";
import type { MobileExperienceManifest, MeHubRowManifest } from "../../mobile/mobileExperienceTypes";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ProfileAvatarModal } from "./ProfileAvatarModal";
import type { MeNavHighlightKey } from "./profileNavHighlight";
import { loadProfileAvatarUri, saveProfileAvatarUri } from "./profileAvatarStorage";
import { fetchCustomerPreferences } from "../customerAppApi";
import {
  loadProfileQuickPrefsForCustomer,
  saveProfileAvatarForCustomer,
  saveProfileLocationForCustomer,
  saveProfilePushForCustomer
} from "./profilePrefsStorage";
import {
  BlurModalScrim,
  FadeSection,
  ProfileCard,
  ProfileHeader,
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
  onOpenSupport: () => void;
  onSignOut: () => void;
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

export function CustomerMeHub(props: Props) {
  const { colors: t } = useAppTheme();
  const { meHub } = props.mobileExperience;
  const isCustomerExperience = props.mobileExperience.roleType === "CUSTOMER";
  const [prefsReady, setPrefsReady] = React.useState(false);
  const [pushOn, setPushOn] = React.useState(true);
  const [locationOn, setLocationOn] = React.useState(false);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isCustomerExperience) return;
    let cancelled = false;
    void (async () => {
      const [localUri, q] = await Promise.all([
        loadProfileAvatarUri(),
        loadProfileQuickPrefsForCustomer(props.authToken)
      ]);
      if (cancelled) return;
      let uri = localUri;
      const tok = props.authToken?.trim();
      if (tok) {
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
      setAvatarUri(uri);
      setPushOn(q.push);
      setLocationOn(q.location);
      setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.authToken, isCustomerExperience]);

  React.useEffect(() => {
    if (isCustomerExperience) return;
    let cancelled = false;
    void loadProfileAvatarUri().then((uri) => {
      if (!cancelled) setAvatarUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [isCustomerExperience]);

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
        case "open_support":
          props.onOpenSupport();
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

  const switchStyles = React.useMemo(
    () =>
      StyleSheet.create({
        switchRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        },
        switchRowLast: { borderBottomWidth: 0 },
        switchLabel: { fontSize: 16, fontWeight: "700", color: t.text, flex: 1, paddingRight: 12 }
      }),
    [t]
  );

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
            showStreak={props.mobileExperience.roleType === "CUSTOMER"}
            avatarUri={avatarUri}
            onAvatarPress={() => setAvatarOpen(true)}
          />
          {meHub.showVenueLine ? (
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.accentBlue, marginBottom: t.space.sm }}>
              {props.venueName}
            </Text>
          ) : null}
        </FadeSection>

        {meHub.sections.map((section) => (
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

        {meHub.showNotificationToggles ? (
          <FadeSection>
            <SectionLabel variant="me">Notifications</SectionLabel>
            <ProfileCard>
              {!prefsReady ? (
                <Text style={{ fontSize: 14, fontWeight: "600", color: t.textMuted }}>Loading…</Text>
              ) : (
                <>
                  <View style={switchStyles.switchRow}>
                    <Text style={switchStyles.switchLabel}>Order & chat push</Text>
                    <ThemedSwitch
                      value={pushOn}
                      onValueChange={(v) => {
                        setPushOn(v);
                        void saveProfilePushForCustomer(v, props.authToken);
                      }}
                    />
                  </View>
                  <View style={[switchStyles.switchRow, switchStyles.switchRowLast]}>
                    <Text style={switchStyles.switchLabel}>Location for venues</Text>
                    <ThemedSwitch
                      value={locationOn}
                      onValueChange={(v) => {
                        setLocationOn(v);
                        void saveProfileLocationForCustomer(v, props.authToken);
                      }}
                    />
                  </View>
                </>
              )}
            </ProfileCard>
          </FadeSection>
        ) : null}
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
