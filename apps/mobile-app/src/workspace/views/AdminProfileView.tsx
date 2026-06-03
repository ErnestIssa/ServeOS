import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  payload: {
    restaurant: {
      name: string;
      openingHours?: string | null;
      establishmentLocation?: string | null;
      venueSubtype?: string | null;
    };
    integrations: Array<{ id: string; label: string; status: string }>;
    billing: { planLabel: string; status: string };
  };
};

export function AdminProfileView(props: Props) {
  const { colors: t } = useAppTheme();
  const r = props.payload.restaurant;
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          padding: 16,
          marginBottom: 12,
          backgroundColor: t.bgElevated
        },
        title: { fontSize: 20, fontWeight: "900", color: t.text },
        sub: { marginTop: 6, fontSize: 14, fontWeight: "600", color: t.textSecondary },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        }
      }),
    [t]
  );

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>{r.name}</Text>
        {r.venueSubtype ? <Text style={styles.sub}>{r.venueSubtype}</Text> : null}
        {r.establishmentLocation ? <Text style={styles.sub}>{r.establishmentLocation}</Text> : null}
        {r.openingHours ? <Text style={styles.sub}>Hours: {r.openingHours}</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={{ fontWeight: "800", color: t.text, marginBottom: 8 }}>Integrations</Text>
        {props.payload.integrations.map((i) => (
          <View key={i.id} style={styles.row}>
            <Text style={{ fontWeight: "600", color: t.text }}>{i.label}</Text>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>{i.status}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={{ fontWeight: "800", color: t.text }}>Billing</Text>
        <Text style={styles.sub}>
          {props.payload.billing.planLabel} · {props.payload.billing.status}
        </Text>
      </View>
    </>
  );
}
