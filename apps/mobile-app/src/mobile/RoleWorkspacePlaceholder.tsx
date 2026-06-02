import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";
import type { MobileRoleType } from "./mobileExperienceTypes";

type Props = {
  roleType: MobileRoleType;
  title: string;
  subtitle: string;
};

export function RoleWorkspacePlaceholder(props: Props) {
  const { colors: t } = useAppTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: t.space.sm,
          padding: t.space.md,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        kicker: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: t.accentBlue,
          marginBottom: 8
        },
        title: { fontSize: 22, fontWeight: "900", color: t.text, marginBottom: 8 },
        sub: { fontSize: 15, fontWeight: "600", color: t.textSecondary, lineHeight: 22 }
      }),
    [t]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{props.roleType} workspace</Text>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.sub}>{props.subtitle}</Text>
    </View>
  );
}
