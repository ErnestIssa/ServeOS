import React from "react";
import { StyleSheet, Text } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { loadAppSettings, saveAppSettings } from "./profilePrefsStorage";
import type { AppSettings } from "./profilePrefsStorage";
import type { AppHubSubscreenScrollProps } from "./profileHubScreenStyle";
import {
  BoolRow,
  FadeSection,
  ProfileCard,
  ProfilePrimaryButton,
  ProfileScreenContainer,
  SectionLabel
} from "./ProfileUi";

type Props = {
  bottomInset: number;
  scrollProps: AppHubSubscreenScrollProps;
};

export function SafetyScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const [settings, setSettings] = React.useState<AppSettings | null>(null);

  React.useEffect(() => {
    void loadAppSettings().then(setSettings);
  }, []);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        loading: { padding: 20, color: t.textMuted, fontWeight: "600" },
        intro: { fontSize: 14, fontWeight: "600", color: t.textSecondary, lineHeight: 20, marginBottom: 14 }
      }),
    [t]
  );

  if (!settings) {
    return (
      <ProfileScreenContainer bottomInset={props.bottomInset} {...props.scrollProps}>
        <Text style={styles.loading}>Loading…</Text>
      </ProfileScreenContainer>
    );
  }

  return (
    <ProfileScreenContainer bottomInset={props.bottomInset} {...props.scrollProps}>
      <FadeSection>
        <SectionLabel variant="me" flushTop>
          Safety & privacy
        </SectionLabel>
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
        <ProfilePrimaryButton label="Save" onPress={() => void saveAppSettings(settings)} />
      </FadeSection>
    </ProfileScreenContainer>
  );
}
