import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AuthUser } from "../../api";
import { ThemedSwitch } from "../../components/ThemedSwitch";
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
  hapticSelect,
  ProfileCard,
  ProfileHeader,
  ProfileScreenContainer,
  SectionLabel,
  SectionRow
} from "./ProfileUi";

type Props = {
  user: AuthUser | null;
  authToken?: string | null;
  venueName: string;
  topInset: number;
  bottomInset: number;
  activeOrderCount: number;
  onNavigateSection: (title: string, subtitle: string | undefined, key: MeNavHighlightKey) => void;
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

export function CustomerMeHub(props: Props) {
  const { colors: t } = useAppTheme();
  const [prefsReady, setPrefsReady] = React.useState(false);
  const [pushOn, setPushOn] = React.useState(true);
  const [locationOn, setLocationOn] = React.useState(false);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = React.useState(false);

  React.useEffect(() => {
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
  }, [props.authToken]);

  const email = props.user?.email?.trim() || "—";

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
            streakScore="4.98"
            avatarUri={avatarUri}
            onAvatarPress={() => setAvatarOpen(true)}
          />
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.accentBlue, marginBottom: t.space.sm }}>
            {props.venueName}
          </Text>
        </FadeSection>

        <FadeSection>
          <SectionLabel variant="me">Activity</SectionLabel>
          <ProfileCard noPad>
            <SectionRow
              title="Upcoming reservations"
              subtitle="Tables and events you've booked"
              highlightKey="me:reservations"
              onPress={props.onOpenBookings}
            />
            <SectionRow
              title="Active orders"
              subtitle={
                props.activeOrderCount > 0
                  ? `${props.activeOrderCount} in progress — track live status`
                  : "No active orders right now"
              }
              highlightKey="me:active_orders"
              onPress={props.onOpenOrders}
            />
            <SectionRow
              title="Review"
              subtitle="Rate your visits and share feedback"
              highlightKey="me:review"
              onPress={() => props.onNavigateReview()}
            />
            <SectionRow
              title="Order history"
              subtitle="Past orders, receipts, and reorder"
              highlightKey="me:order_history"
              last
              onPress={() => props.onNavigateSection("Order history", "Receipts and past totals", "me:order_history")}
            />
          </ProfileCard>
        </FadeSection>

        <FadeSection>
          <SectionLabel variant="me">Places & payment</SectionLabel>
          <ProfileCard noPad>
            <SectionRow
              title="Saved & favorite venues"
              subtitle="Restaurants you love"
              highlightKey="me:favorites"
              onPress={() => props.onNavigateSection("Saved venues", "Favorites and recents", "me:favorites")}
            />
            <SectionRow
              title="Payment methods"
              subtitle="Cards and Swish"
              highlightKey="me:payments"
              onPress={() => props.onNavigateSection("Payment methods", "Stripe / Swish", "me:payments")}
            />
            <SectionRow
              title="Addresses"
              subtitle="Delivery and saved locations"
              highlightKey="me:addresses"
              last
              onPress={() => props.onNavigateSection("Addresses", "Saved delivery addresses", "me:addresses")}
            />
          </ProfileCard>
        </FadeSection>

        <FadeSection>
          <SectionLabel variant="me">Rewards</SectionLabel>
          <ProfileCard noPad>
            <SectionRow
              title="Rewards & loyalty"
              subtitle="Points, offers, and perks"
              highlightKey="me:rewards"
              last
              onPress={() => props.onNavigateSection("Rewards & loyalty", "Coming soon", "me:rewards")}
            />
          </ProfileCard>
        </FadeSection>

        <FadeSection>
          <SectionLabel variant="me">Personal preferences</SectionLabel>
          <ProfileCard>
            <SectionRow
              title="Dietary & allergies"
              subtitle="Filters for menu and ordering"
              highlightKey="me:preferences"
              last
              onPress={() => props.onNavigateSection("Dietary & allergies", "Set preferences for safer ordering", "me:preferences")}
            />
          </ProfileCard>
        </FadeSection>

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

        <FadeSection>
          <SectionLabel variant="me">Help</SectionLabel>
          <ProfileCard noPad>
            <SectionRow
              title="Support"
              subtitle="Quick help and contact"
              highlightKey="me:support"
              last
              onPress={props.onOpenSupport}
            />
          </ProfileCard>
        </FadeSection>

        <FadeSection>
          <SectionLabel variant="me">Session</SectionLabel>
          <ProfileCard noPad>
            <SectionRow
              title="Log out"
              subtitle="Ends this session on your device"
              danger
              last
              noHighlight
              onPress={() => setSignOutOpen(true)}
            />
          </ProfileCard>
        </FadeSection>
      </ProfileScreenContainer>

      <ProfileAvatarModal
        visible={avatarOpen}
        uri={avatarUri}
        onClose={() => setAvatarOpen(false)}
        onSaved={(uri) => {
          setAvatarUri(uri);
          void saveProfileAvatarUri(uri);
          void saveProfileAvatarForCustomer(uri, props.authToken);
          props.onAvatarSaved?.(uri);
        }}
      />

      <BlurModalScrim
        visible={signOutOpen}
        title="Log out?"
        body={`${email}\n\nYou can sign back in with the same guest account.`}
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
