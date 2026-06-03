import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MeHubSectionManifest } from "../../mobile/mobileExperienceTypes";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  user: { email: string | null; phone: string | null; role: string } | null;
  venue: { restaurantId: string; name: string; role: string } | null;
  sections: MeHubSectionManifest[];
  onSignOut: () => void;
};

export function StaffProfileView(props: Props) {
  const { colors: t } = useAppTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
          backgroundColor: t.bgElevated
        },
        title: { fontSize: 22, fontWeight: "900", color: t.text },
        sub: { marginTop: 6, fontSize: 14, fontWeight: "600", color: t.textSecondary },
        section: { marginTop: 12, fontSize: 12, fontWeight: "800", color: t.textMuted },
        row: {
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        },
        danger: { color: t.danger, fontWeight: "800", marginTop: 16, textAlign: "center" }
      }),
    [t]
  );

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>{props.user?.email ?? "Account"}</Text>
        {props.venue ? (
          <Text style={styles.sub}>
            {props.venue.name} · {props.venue.role}
          </Text>
        ) : null}
      </View>
      {props.sections.map((sec) => (
        <View key={sec.id}>
          <Text style={styles.section}>{sec.label}</Text>
          {sec.rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <Text style={{ fontWeight: "700", color: row.danger ? t.danger : t.text }}>{row.title}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 2 }}>{row.subtitle}</Text>
              {row.action === "sign_out" ? (
                <Pressable onPress={props.onSignOut}>
                  <Text style={styles.danger}>Log out</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </>
  );
}
