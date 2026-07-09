import * as Haptics from "expo-haptics";
import React from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";
import { AdminNavChevron } from "../../shell/AdminNavChevron";
import { useAppTheme } from "../../theme/AppThemeContext";
import { AppControlCenterBody, type AppControlCenterBodyProps } from "./AppControlCenterBody";
import { FadeSection, ProfileCard } from "./ProfileUi";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = AppControlCenterBodyProps;

export function MeHubMoreSection(props: Props) {
  const { colors: t } = useAppTheme();
  const [expanded, setExpanded] = React.useState(false);
  const { controlCentre } = props.mobileExperience;

  const hasContent =
    (!props.hideChips && controlCentre.chips.length > 0) ||
    controlCentre.sections.some((s) => s.rows.length > 0) ||
    controlCentre.showDarkModeToggle;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 16,
          paddingHorizontal: t.space.sm
        },
        headerTitle: {
          fontSize: 22,
          fontWeight: "900",
          color: t.accentPurple,
          letterSpacing: -0.3
        },
        body: {
          paddingTop: 4,
          paddingBottom: t.space.xs
        },
        pressed: { opacity: 0.9 }
      }),
    [t]
  );

  if (!hasContent) return null;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
    void Haptics.selectionAsync();
  }

  return (
    <FadeSection>
      <ProfileCard noPad>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel="More"
          accessibilityHint={expanded ? "Collapse more options" : "Expand more options"}
          onPress={toggle}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        >
          <Text style={styles.headerTitle}>More</Text>
          <AdminNavChevron open={expanded} color={t.accentBlue} size={14} />
        </Pressable>
        {expanded ? (
          <View style={styles.body}>
            <AppControlCenterBody {...props} />
          </View>
        ) : null}
      </ProfileCard>
    </FadeSection>
  );
}
