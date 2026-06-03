import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { shiftBreakToggle, shiftClockIn, shiftClockOut } from "../../mobile/workspaceApi";

type Props = {
  authToken: string;
  restaurantId: string;
  payload: {
    myShift: {
      role: string;
      restaurantName: string;
      clockedIn: boolean;
      clockInAt: string | null;
      onBreak: boolean;
    };
    teamSchedule: Array<{ role: string; email: string | null }>;
    canSeeTeam: boolean;
  };
  onReload: () => void;
};

export function StaffScheduleView(props: Props) {
  const { colors: t } = useAppTheme();
  const s = props.payload.myShift;
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: t.radius.card,
          padding: t.space.md,
          marginBottom: t.space.md,
          backgroundColor: t.bgElevated
        },
        title: { fontSize: 18, fontWeight: "900", color: t.text },
        sub: { marginTop: 6, fontSize: 14, fontWeight: "600", color: t.textSecondary },
        row: { flexDirection: "row", gap: 10, marginTop: 14 },
        btn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: t.accentPurple,
          alignItems: "center"
        },
        btnOut: { backgroundColor: t.danger },
        btnGhost: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.border,
          alignItems: "center"
        },
        btnText: { color: "#fff", fontWeight: "800" },
        member: {
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        }
      }),
    [t]
  );

  const act = async (fn: () => Promise<unknown>) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fn();
    props.onReload();
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>My shift · {s.restaurantName}</Text>
        <Text style={styles.sub}>Role today: {s.role}</Text>
        <Text style={styles.sub}>
          {s.clockedIn
            ? `Clocked in${s.clockInAt ? ` at ${new Date(s.clockInAt).toLocaleTimeString()}` : ""}`
            : "Not clocked in"}
          {s.onBreak ? " · On break" : ""}
        </Text>
        <View style={styles.row}>
          {!s.clockedIn ? (
            <Pressable
              style={styles.btn}
              onPress={() => act(() => shiftClockIn(props.authToken, props.restaurantId))}
            >
              <Text style={styles.btnText}>Clock in</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.btn, styles.btnOut]}
                onPress={() => act(() => shiftClockOut(props.authToken, props.restaurantId))}
              >
                <Text style={styles.btnText}>Clock out</Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() => act(() => shiftBreakToggle(props.authToken, props.restaurantId))}
              >
                <Text style={{ fontWeight: "800", color: t.text }}>{s.onBreak ? "End break" : "Break"}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      {props.payload.canSeeTeam ? (
        <View style={styles.card}>
          <Text style={styles.title}>Team today</Text>
          {props.payload.teamSchedule.map((m, i) => (
            <View key={`${m.email}-${i}`} style={styles.member}>
              <Text style={{ fontWeight: "700", color: t.text }}>{m.email ?? "Staff"}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>{m.role}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}
