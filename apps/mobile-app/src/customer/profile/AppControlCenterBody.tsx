import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AuthUser } from "../../api";
import { ThemedSwitch } from "../../components/ThemedSwitch";
import type {
  ControlCentreChipManifest,
  ControlCentreRowManifest,
  MobileExperienceManifest
} from "../../mobile/mobileExperienceTypes";
import { useAppTheme } from "../../theme/AppThemeContext";
import { loadAppSettingsForCustomer, saveAppSettingsForCustomer } from "./profilePrefsStorage";
import type { AppNavHighlightKey } from "./profileNavHighlight";
import { FadeSection, ProfileCard, SectionLabel, SectionRow, TopChip } from "./ProfileUi";

export type AppControlCenterBodyProps = {
  user: AuthUser | null;
  authToken?: string | null;
  mobileExperience: MobileExperienceManifest;
  hideChips?: boolean;
  onNavigateHelp: () => void;
  onNavigateSafety: () => void;
  onNavigateAppSettings: () => void;
  onNavigateSection: (title: string, subtitle: string | undefined, key: AppNavHighlightKey) => void;
  onNavigateScreen: (screenKey: string, title: string, subtitle?: string) => void;
  onChooseVenue: () => void;
};

function chipVariant(
  action: ControlCentreChipManifest["action"]
): "help" | "safety" | "settings" {
  if (action === "navigate_safety") return "safety";
  if (action === "navigate_settings") return "settings";
  return "help";
}

export function AppControlCenterBody(props: AppControlCenterBodyProps) {
  const { colors: t, scheme, setScheme } = useAppTheme();
  const { controlCentre } = props.mobileExperience;

  const onChipPress = React.useCallback(
    (chip: ControlCentreChipManifest) => {
      switch (chip.action) {
        case "navigate_help":
          props.onNavigateHelp();
          break;
        case "navigate_safety":
          props.onNavigateSafety();
          break;
        case "navigate_settings":
          props.onNavigateAppSettings();
          break;
      }
    },
    [props]
  );

  const onRowPress = React.useCallback(
    (row: ControlCentreRowManifest) => {
      switch (row.action) {
        case "navigate_help":
          props.onNavigateHelp();
          break;
        case "navigate_safety":
          props.onNavigateSafety();
          break;
        case "navigate_settings":
          props.onNavigateAppSettings();
          break;
        case "choose_venue":
          props.onChooseVenue();
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
            row.id as AppNavHighlightKey
          );
          break;
      }
    },
    [props]
  );

  const appearanceStyles = React.useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        },
        label: { fontSize: 16, fontWeight: "700", color: t.text, flex: 1, paddingRight: 12 }
      }),
    [t]
  );

  const hasContent =
    (!props.hideChips && controlCentre.chips.length > 0) ||
    controlCentre.sections.some((s) => s.rows.length > 0) ||
    controlCentre.showDarkModeToggle;

  if (!hasContent) return null;

  return (
    <>
      {!props.hideChips && controlCentre.chips.length > 0 ? (
        <FadeSection>
          <View style={{ flexDirection: "row", marginBottom: t.space.sm, marginHorizontal: -4 }}>
            {controlCentre.chips.map((chip) => (
              <TopChip
                key={chip.id}
                variant={chipVariant(chip.action)}
                label={chip.label}
                highlightKey={chip.id as AppNavHighlightKey}
                onPress={() => onChipPress(chip)}
              />
            ))}
          </View>
        </FadeSection>
      ) : null}

      {controlCentre.sections.map((section) => (
        <FadeSection key={section.id}>
          <SectionLabel variant="me">{section.label}</SectionLabel>
          <ProfileCard noPad>
            {section.rows.map((row) => (
              <SectionRow
                key={row.id}
                title={row.title}
                subtitle={row.subtitle}
                highlightKey={row.id as AppNavHighlightKey}
                last={!!row.last}
                onPress={() => onRowPress(row)}
              />
            ))}
          </ProfileCard>
        </FadeSection>
      ))}

      {controlCentre.showDarkModeToggle ? (
        <FadeSection>
          <SectionLabel variant="me">Appearance</SectionLabel>
          <ProfileCard>
            <View style={appearanceStyles.row}>
              <Text style={appearanceStyles.label}>Dark mode</Text>
              <ThemedSwitch
                value={scheme === "dark"}
                onValueChange={(v) => {
                  const mode = v ? "dark" : "light";
                  setScheme(mode);
                  void (async () => {
                    const settings = await loadAppSettingsForCustomer(
                      props.mobileExperience.roleType === "CUSTOMER" ? props.authToken : undefined
                    );
                    const next = { ...settings, nightMode: mode as "dark" | "light" };
                    await saveAppSettingsForCustomer(
                      next,
                      props.mobileExperience.roleType === "CUSTOMER" ? props.authToken : undefined
                    );
                  })();
                }}
              />
            </View>
          </ProfileCard>
        </FadeSection>
      ) : null}
    </>
  );
}
