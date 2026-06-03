import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  payload: {
    kpis: Array<{ id: string; label: string; value: string }>;
    alerts: Array<{ id: string; title: string; body: string }>;
    quickActions: Array<{ id: string; label: string; tabKey: string }>;
  };
  onNavigateTab: (tabKey: string) => void;
};

export function AdminDashboardView(props: Props) {
  const { colors: t } = useAppTheme();
  const p = props.payload;
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
        kpi: {
          width: "48%",
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          padding: 14,
          backgroundColor: t.bgElevated
        },
        kpiVal: { fontSize: 24, fontWeight: "900", color: t.accentPurple },
        kpiLabel: { marginTop: 4, fontSize: 12, fontWeight: "700", color: t.textMuted },
        alert: {
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: `${t.danger}55`,
          backgroundColor: `${t.danger}11`
        },
        action: {
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          backgroundColor: t.accentPurple
        }
      }),
    [t]
  );

  return (
    <>
      <View style={styles.grid}>
        {p.kpis.map((k) => (
          <View key={k.id} style={styles.kpi}>
            <Text style={styles.kpiVal}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>
      {p.alerts.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: "800", color: t.text, marginBottom: 8 }}>Alerts</Text>
          {p.alerts.map((a) => (
            <View key={a.id} style={styles.alert}>
              <Text style={{ fontWeight: "800", color: t.text }}>{a.title}</Text>
              <Text style={{ color: t.textSecondary, marginTop: 4 }}>{a.body}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: "800", color: t.text, marginBottom: 8 }}>Quick actions</Text>
        {p.quickActions.map((a) => (
          <Pressable key={a.id} style={styles.action} onPress={() => props.onNavigateTab(a.tabKey)}>
            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
