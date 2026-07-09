import React from "react";
import { StyleSheet, Text, TextInput, View, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import type { AuthUser } from "../../api";
import type { MobileExperienceManifest } from "../../mobile/mobileExperienceTypes";
import { useAppTheme } from "../../theme/AppThemeContext";
import { SkeletonBlock, SkeletonScreenFill } from "../../components/skeleton/SkeletonUi";
import { loadAppSettingsForCustomer, saveAppSettingsForCustomer, loadProfileQuickPrefsForCustomer, saveProfilePushForCustomer, saveProfileLocationForCustomer } from "./profilePrefsStorage";
import type { AppSettings, SettingsDetailKey } from "./profilePrefsStorage";
import {
  BoolRow,
  FadeSection,
  OptionRow,
  ProfileCard,
  ProfilePrimaryButton,
  ProfileScreenContainer,
  RowItem,
  SectionLabel
} from "./ProfileUi";

/** Avoid `ReturnType<typeof StyleSheet.create>` — some TS setups mis-resolve `StyleSheet` in type position. */
type SettingsDetailStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

type HubProps = {
  bottomInset: number;
  accountKeys: SettingsDetailKey[];
  generalKeys: SettingsDetailKey[];
  platformKeys: SettingsDetailKey[];
  onOpenDetail: (key: SettingsDetailKey) => void;
};

const ACCOUNT_ROWS = [
  { key: "manage_account" as const, icon: "👤", title: "Manage account", subtitle: "Email, guest profile" },
  { key: "privacy" as const, icon: "🔒", title: "Privacy", subtitle: "Visibility & analytics" },
  { key: "address" as const, icon: "📍", title: "Delivery address", subtitle: "Saved for orders" },
  { key: "security" as const, icon: "🛡️", title: "Security", subtitle: "Password and protection" }
];

const GENERAL_ROWS = [
  { key: "accessibility" as const, icon: "♿", title: "Accessibility", subtitle: "Motion & text" },
  { key: "night_mode" as const, icon: "🌙", title: "Appearance", subtitle: "System, light, or dark" },
  { key: "shortcuts" as const, icon: "⚡", title: "Shortcuts", subtitle: "Quick actions" },
  {
    key: "communication" as const,
    icon: "💬",
    title: "Communication",
    subtitle: "Push, location, email & SMS"
  },
  { key: "navigation" as const, icon: "🧭", title: "Navigation", subtitle: "Preferred maps app" },
  { key: "sounds_voice" as const, icon: "🔊", title: "Sounds & voice", subtitle: "Alerts & guidance" }
];

const PLATFORM_ROWS = [
  { key: "connected_devices" as const, icon: "🖨️", title: "Connected devices", subtitle: "Printers, KDS, displays" },
  { key: "sessions" as const, icon: "📱", title: "Session management", subtitle: "Active sessions and devices" }
];

export function SettingsHomeScreen(props: HubProps) {
  const accountRows = ACCOUNT_ROWS.filter((r) => props.accountKeys.includes(r.key));
  const generalRows = GENERAL_ROWS.filter((r) => props.generalKeys.includes(r.key));
  const platformRows = PLATFORM_ROWS.filter((r) => props.platformKeys.includes(r.key));

  return (
    <ProfileScreenContainer topInset={0} bottomInset={props.bottomInset}>
      {accountRows.length > 0 ? (
        <FadeSection>
          <SectionLabel variant="me">Account</SectionLabel>
          <ProfileCard noPad>
            {accountRows.map((row, i) => (
              <RowItem
                key={row.key}
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                highlightKey={`app:settings:${row.key}`}
                last={i === accountRows.length - 1}
                onPress={() => props.onOpenDetail(row.key)}
              />
            ))}
          </ProfileCard>
        </FadeSection>
      ) : null}
      {generalRows.length > 0 ? (
        <FadeSection>
          <SectionLabel variant="me">Preferences</SectionLabel>
          <ProfileCard noPad>
            {generalRows.map((row, i) => (
              <RowItem
                key={row.key}
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                highlightKey={`app:settings:${row.key}`}
                last={i === generalRows.length - 1}
                onPress={() => props.onOpenDetail(row.key)}
              />
            ))}
          </ProfileCard>
        </FadeSection>
      ) : null}
      {platformRows.length > 0 ? (
        <FadeSection>
          <SectionLabel variant="me">Platform</SectionLabel>
          <ProfileCard noPad>
            {platformRows.map((row, i) => (
              <RowItem
                key={row.key}
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                highlightKey={`app:settings:${row.key}`}
                last={i === platformRows.length - 1}
                onPress={() => props.onOpenDetail(row.key)}
              />
            ))}
          </ProfileCard>
        </FadeSection>
      ) : null}
    </ProfileScreenContainer>
  );
}

type DetailProps = {
  detailKey: SettingsDetailKey;
  user: AuthUser | null;
  authToken?: string | null;
  roleType: MobileExperienceManifest["roleType"];
  bottomInset: number;
};

export function SettingsDetailScreen(props: DetailProps) {
  const { colors: t, setScheme } = useAppTheme();
  const [settings, setSettings] = React.useState<AppSettings | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    void loadAppSettingsForCustomer(props.authToken).then(setSettings);
  }, [props.authToken]);

  const patch = (partial: Partial<AppSettings>) => {
    setSettings((s) => (s ? { ...s, ...partial } : s));
    setSaved(false);
  };

  const save = async () => {
    if (!settings) return;
    await saveAppSettingsForCustomer(settings, props.authToken);
    if (settings.nightMode === "dark") setScheme("dark");
    else if (settings.nightMode === "light") setScheme("light");
    setSaved(true);
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        loading: { fontSize: 15, fontWeight: "600", color: t.textMuted, paddingVertical: 24 },
        label: { fontSize: 12, fontWeight: "800", color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
        readOnly: { marginTop: 6, fontSize: 17, fontWeight: "700", color: t.text },
        hint: { marginTop: 14, fontSize: 13, fontWeight: "600", color: t.textMuted, lineHeight: 19 },
        mt: { marginTop: 14 },
        gap12: { height: 12 },
        input: {
          marginTop: 8,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: t.radius.input,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          fontWeight: "600",
          color: t.text,
          backgroundColor: t.bgElevated
        }
      }),
    [t]
  );

  if (!settings) {
    return (
      <ProfileScreenContainer topInset={0} bottomInset={props.bottomInset}>
        <SkeletonScreenFill style={{ flex: 1, paddingTop: 8 }}>
          <SkeletonBlock lines={5} style={{ marginBottom: 20 }} />
          <SkeletonBlock lines={3} />
        </SkeletonScreenFill>
      </ProfileScreenContainer>
    );
  }

  return (
    <ProfileScreenContainer topInset={0} bottomInset={props.bottomInset}>
      <FadeSection>
        <ProfileCard>
          {props.detailKey === "communication" ? (
            <CommunicationSettingsPanel
              settings={settings}
              patch={patch}
              authToken={props.authToken}
              roleType={props.roleType}
              styles={styles}
            />
          ) : (
            renderDetailBody(props.detailKey, settings, patch, props.user, styles)
          )}
        </ProfileCard>
        <ProfilePrimaryButton label={saved ? "Saved" : "Save"} onPress={() => void save()} />
      </FadeSection>
    </ProfileScreenContainer>
  );
}

function CommunicationSettingsPanel(props: {
  settings: AppSettings;
  patch: (p: Partial<AppSettings>) => void;
  authToken?: string | null;
  roleType: MobileExperienceManifest["roleType"];
  styles: SettingsDetailStyles;
}) {
  const isCustomer = props.roleType === "CUSTOMER";
  const [devicePush, setDevicePush] = React.useState(true);
  const [deviceLocation, setDeviceLocation] = React.useState(false);
  const [deviceReady, setDeviceReady] = React.useState(false);
  const { styles, settings: s, patch } = props;

  React.useEffect(() => {
    void loadProfileQuickPrefsForCustomer(props.authToken).then((q) => {
      setDevicePush(q.push);
      setDeviceLocation(q.location);
      setDeviceReady(true);
    });
  }, [props.authToken]);

  return (
    <>
      <Text style={styles.label}>This device</Text>
      {deviceReady ? (
        <>
          <BoolRow
            label={isCustomer ? "Order & chat push" : "Operational push alerts"}
            value={devicePush}
            onChange={(v) => {
              setDevicePush(v);
              void saveProfilePushForCustomer(v, props.authToken);
            }}
          />
          {isCustomer ? (
            <>
              <View style={styles.gap12} />
              <BoolRow
                label="Location for venues"
                value={deviceLocation}
                onChange={(v) => {
                  setDeviceLocation(v);
                  void saveProfileLocationForCustomer(v, props.authToken);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
      <Text style={[styles.label, styles.mt]}>Account channels</Text>
      <BoolRow
        label="Email"
        value={s.communication.email}
        onChange={(email) => patch({ communication: { ...s.communication, email } })}
      />
      <View style={styles.gap12} />
      <BoolRow
        label="Push notifications"
        value={s.communication.push}
        onChange={(push) => patch({ communication: { ...s.communication, push } })}
      />
      <View style={styles.gap12} />
      <BoolRow
        label="SMS"
        value={s.communication.sms}
        onChange={(sms) => patch({ communication: { ...s.communication, sms } })}
      />
      <Text style={styles.hint}>
        Device toggles apply immediately on this phone. Account channels sync when you save.
      </Text>
    </>
  );
}

function renderDetailBody(
  key: SettingsDetailKey,
  s: AppSettings,
  patch: (p: Partial<AppSettings>) => void,
  user: AuthUser | null,
  styles: SettingsDetailStyles
): React.ReactNode {
  switch (key) {
    case "manage_account":
      return (
        <>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.readOnly}>{user?.email?.trim() || "—"}</Text>
          <Text style={[styles.label, styles.mt]}>Account type</Text>
          <Text style={styles.readOnly}>Guest (customer)</Text>
          <Text style={styles.hint}>Venue switching lives under Orders. Staff use a separate sign-in.</Text>
        </>
      );
    case "privacy":
      return (
        <>
          {(["public", "venues", "private"] as const).map((v) => (
            <OptionRow
              key={v}
              label={v === "public" ? "Public" : v === "venues" ? "Venues I visit" : "Private"}
              selected={s.privacy.profileVisibility === v}
              onPress={() => patch({ privacy: { ...s.privacy, profileVisibility: v } })}
            />
          ))}
          <View style={styles.gap12} />
          <BoolRow
            label="Share analytics"
            value={s.privacy.shareAnalytics}
            onChange={(shareAnalytics) => patch({ privacy: { ...s.privacy, shareAnalytics } })}
          />
        </>
      );
    case "address":
      return <AddressForm styles={styles} />;
    case "night_mode":
      return (
        <>
          {(["system", "light", "dark"] as const).map((v) => (
            <OptionRow
              key={v}
              label={v === "system" ? "Match system" : v === "light" ? "Light" : "Dark"}
              selected={s.nightMode === v}
              onPress={() => patch({ nightMode: v })}
            />
          ))}
        </>
      );
    case "navigation":
      return (
        <>
          {(["apple", "google", "waze"] as const).map((v) => (
            <OptionRow
              key={v}
              label={v === "apple" ? "Apple Maps" : v === "google" ? "Google Maps" : "Waze"}
              selected={s.navigation.preferredMaps === v}
              onPress={() => patch({ navigation: { ...s.navigation, preferredMaps: v } })}
            />
          ))}
        </>
      );
    case "accessibility":
      return (
        <>
          <BoolRow
            label="Reduce motion"
            value={s.accessibility.reduceMotion}
            onChange={(reduceMotion) => patch({ accessibility: { ...s.accessibility, reduceMotion } })}
          />
          <View style={styles.gap12} />
          <BoolRow
            label="Bold text"
            value={s.accessibility.boldText}
            onChange={(boldText) => patch({ accessibility: { ...s.accessibility, boldText } })}
          />
        </>
      );
    case "shortcuts":
      return (
        <BoolRow
          label="Enable shortcuts"
          value={s.shortcuts.enabled}
          onChange={(enabled) => patch({ shortcuts: { enabled } })}
        />
      );
    case "communication":
      return null;
    case "sounds_voice":
      return (
        <>
          <BoolRow
            label="Message sounds"
            value={s.soundsVoice.messageSounds}
            onChange={(messageSounds) => patch({ soundsVoice: { ...s.soundsVoice, messageSounds } })}
          />
          <View style={styles.gap12} />
          <BoolRow
            label="Voice guidance"
            value={s.soundsVoice.voiceGuidance}
            onChange={(voiceGuidance) => patch({ soundsVoice: { ...s.soundsVoice, voiceGuidance } })}
          />
        </>
      );
    case "connected_devices":
      return (
        <>
          <Text style={styles.label}>Hardware</Text>
          <Text style={styles.readOnly}>No devices paired yet</Text>
          <Text style={styles.hint}>
            Printers, kitchen displays, and POS terminals appear here when connected to your venue or account.
          </Text>
        </>
      );
    case "sessions":
      return (
        <>
          <Text style={styles.label}>This device</Text>
          <Text style={styles.readOnly}>Active now</Text>
          <Text style={[styles.label, styles.mt]}>Other sessions</Text>
          <Text style={styles.readOnly}>None detected</Text>
          <Text style={styles.hint}>Session management will sync with your account when the API is connected.</Text>
        </>
      );
    case "security":
      return (
        <>
          <Text style={styles.label}>Password</Text>
          <Text style={styles.readOnly}>Managed via sign-in provider</Text>
          <Text style={[styles.label, styles.mt]}>Two-factor authentication</Text>
          <Text style={styles.readOnly}>Coming soon</Text>
          <Text style={styles.hint}>Use Session management to review devices signed in to ServeOS.</Text>
        </>
      );
    default:
      return null;
  }
}

function AddressForm(props: { styles: SettingsDetailStyles }) {
  const { colors: t } = useAppTheme();
  const [line1, setLine1] = React.useState("");
  const [city, setCity] = React.useState("");
  const { styles } = props;
  return (
    <>
      <Text style={styles.label}>Street</Text>
      <TextInput style={styles.input} value={line1} onChangeText={setLine1} placeholder="Street address" placeholderTextColor={t.textMuted} />
      <Text style={[styles.label, styles.mt]}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={t.textMuted} />
      <Text style={styles.hint}>Saved locally until address API is connected.</Text>
    </>
  );
}
