import { BlurView } from "expo-blur";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { hapticSelection } from "./haptics";
import type { MentionableUser } from "./mentions";
import { radius, shadows, spacing } from "./theme";

type Props = {
  users: MentionableUser[];
  onPick: (user: MentionableUser) => void;
};

export function MentionSuggestions({ users, onPick }: Props) {
  if (users.length === 0) return null;

  return (
    <View style={[styles.wrap, shadows.float]}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={88} tint="light" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
      )}
      <ScrollView keyboardShouldPersistTaps="always" style={styles.scroll} nestedScrollEnabled>
        {users.map((user) => (
          <Pressable
            key={user.id}
            style={styles.row}
            onPress={() => {
              hapticSelection();
              onPick(user);
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.name}>@{user.name.replace(/\s+/g, "")}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {user.unit} · {user.source}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    maxHeight: 180
  },
  androidGlass: { backgroundColor: "rgba(255,255,255,0.94)" },
  scroll: { maxHeight: 180 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(23,95,97,0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 13, fontWeight: "800", color: "#175F61" },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: "800", color: "#111B21" },
  meta: { fontSize: 11, color: "#667781", marginTop: 1 }
});
