import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { dismissStaffTask } from "../../mobile/workspaceApi";

type Task = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  urgency: "low" | "medium" | "high";
  dueAt: string | null;
  relatedOrderId: string | null;
  quickAction: string | null;
};

type Props = {
  authToken: string;
  restaurantId: string;
  tasks: Task[];
  onReload: () => void;
  onOpenOrder?: (orderId: string) => void;
};

const URGENCY_COLOR = (t: ReturnType<typeof useAppTheme>["colors"], u: string) =>
  u === "high" ? t.danger : u === "medium" ? "#D97706" : t.textMuted;

export function StaffTasksView(props: Props) {
  const { colors: t } = useAppTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderLeftWidth: 4,
          borderRadius: t.radius.card,
          padding: t.space.md,
          marginBottom: t.space.sm,
          backgroundColor: t.bgElevated
        },
        title: { fontSize: 16, fontWeight: "800", color: t.text },
        sub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: t.textSecondary },
        row: { flexDirection: "row", gap: 8, marginTop: 12 },
        btn: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: t.accentPurple
        },
        btnGhost: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.border
        },
        btnText: { fontSize: 12, fontWeight: "800", color: "#fff" },
        btnGhostText: { fontSize: 12, fontWeight: "700", color: t.text }
      }),
    [t]
  );

  if (!props.tasks.length) {
    return (
      <Text style={{ textAlign: "center", marginTop: 32, color: t.textMuted, fontWeight: "600" }}>
        No open tasks — you're caught up.
      </Text>
    );
  }

  return (
    <>
      {props.tasks.map((task) => (
        <View
          key={task.id}
          style={[styles.card, { borderLeftColor: URGENCY_COLOR(t, task.urgency), borderColor: t.border }]}
        >
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.sub}>{task.subtitle}</Text>
          {task.dueAt ? (
            <Text style={[styles.sub, { marginTop: 4 }]}>Due {new Date(task.dueAt).toLocaleTimeString()}</Text>
          ) : null}
          <View style={styles.row}>
            {task.quickAction === "open_order" && task.relatedOrderId && props.onOpenOrder ? (
              <Pressable style={styles.btn} onPress={() => props.onOpenOrder!(task.relatedOrderId!)}>
                <Text style={styles.btnText}>Open order</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.btnGhost}
              onPress={() => {
                void Haptics.selectionAsync();
                void dismissStaffTask(props.authToken, props.restaurantId, task.id).then(() => props.onReload());
              }}
            >
              <Text style={styles.btnGhostText}>Resolve</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </>
  );
}
