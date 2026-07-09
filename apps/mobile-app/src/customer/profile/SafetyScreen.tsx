import React from "react";
import { StyleSheet, Text } from "react-native";
import { SkeletonBlock, SkeletonScreenFill } from "../../components/skeleton/SkeletonUi";
import { useAppTheme } from "../../theme/AppThemeContext";
import { loadAppSettingsForCustomer, saveAppSettingsForCustomer } from "./profilePrefsStorage";
import type { AppSettings } from "./profilePrefsStorage";
import type { SettingsDetailKey } from "./profilePrefsStorage";
import {
  BoolRow,
  FadeSection,
  ProfileCard,
  ProfilePrimaryButton,
  ProfileScreenContainer,
  RowItem,
  SectionLabel
} from "./ProfileUi";

type Props = {
  authToken?: string | null;
  bottomInset: number;
  onOpenSettingsDetail?: (key: SettingsDetailKey) => void;
};

export function SafetyScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const [settings, setSettings] = React.useState<AppSettings | null>(null);

  React.useEffect(() => {
    void loadAppSettingsForCustomer(props.authToken).then(setSettings);
  }, [props.authToken]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        intro: {
          fontSize: 14,
          fontWeight: "600",
          color: t.textSecondary,
          lineHeight: 20,
          marginBottom: 14
        }
      }),
    [t]
  );

  if (!settings) {
    return (
      <ProfileScreenContainer topInset={0} bottomInset={props.bottomInset}>
        <SkeletonScreenFill style={{ flex: 1, paddingTop: 8 }}>
          <SkeletonBlock lines={4} style={{ marginBottom: 16 }} />
          <SkeletonBlock lines={3} />
        </SkeletonScreenFill>
      </ProfileScreenContainer>
    );
  }

  return (
    <ProfileScreenContainer topInset={0} bottomInset={props.bottomInset}>
      <FadeSection>
        <SectionLabel variant="me">Visit safety</SectionLabel>
        <ProfileCard>
          <Text style={styles.intro}>Trip and check-in preferences for visits and pickups.</Text>
          <BoolRow
            label="Safety PIN"
            value={settings.safety.pinEnabled}
            onChange={(pinEnabled) => setSettings({ ...settings, safety: { ...settings.safety, pinEnabled } })}
          />
          <BoolRow
            label="Trip check reminders"
            value={settings.safety.tripCheck}
            onChange={(tripCheck) => setSettings({ ...settings, safety: { ...settings.safety, tripCheck } })}
          />
        </ProfileCard>
        <ProfilePrimaryButton
          label="Save safety preferences"
          onPress={() => void saveAppSettingsForCustomer(settings, props.authToken)}
        />
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Privacy & data</SectionLabel>
        <ProfileCard noPad>
          <RowItem
            icon="🔒"
            title="Privacy controls"
            subtitle="Profile visibility and analytics sharing"
            highlightKey="app:settings:privacy"
            last
            onPress={() => props.onOpenSettingsDetail?.("privacy")}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Account security</SectionLabel>
        <ProfileCard noPad>
          <RowItem
            icon="📱"
            title="Session management"
            subtitle="Devices signed in to your account"
            highlightKey="app:settings:sessions"
            onPress={() => props.onOpenSettingsDetail?.("sessions")}
          />
          <RowItem
            icon="🛡️"
            title="Security settings"
            subtitle="Password and account protection"
            highlightKey="app:settings:security"
            last
            onPress={() => props.onOpenSettingsDetail?.("security")}
          />
        </ProfileCard>
      </FadeSection>
    </ProfileScreenContainer>
  );
}
