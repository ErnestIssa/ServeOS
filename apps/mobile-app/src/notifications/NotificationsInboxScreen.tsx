import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "../theme/AppThemeContext";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type PlatformNotification
} from "./notificationsApi";

type Props = {
  authToken: string;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  onUnreadCountChange?: (count: number) => void;
};

function BackChevron({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M14.707 17.293a1 1 0 0 1-1.414 1.414l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 1.414L9.414 12l5.293 5.293Z"
      />
    </Svg>
  );
}

function categoryLabel(category: string): string {
  switch (category) {
    case "ORDER":
      return "Orders";
    case "CHAT":
      return "Messages";
    case "RESERVATION":
      return "Bookings";
    case "STAFF":
      return "Team";
    case "PAYMENT":
      return "Payments";
    case "SYSTEM":
      return "System";
    default:
      return category;
  }
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export function NotificationsInboxScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [items, setItems] = React.useState<PlatformNotification[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const res = await fetchNotifications(props.authToken, { limit: 50 });
    if (!res.ok) {
      setError(res.error ?? "Could not load notifications");
      setItems([]);
      return;
    }
    setError(null);
    setItems(res.notifications);
    const unread = res.notifications.filter((n) => !n.readAt).length;
    props.onUnreadCountChange?.(unread);
  }, [props.authToken, props.onUnreadCountChange]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const onMarkAll = React.useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markAllNotificationsRead(props.authToken);
    await reload();
  }, [props.authToken, reload]);

  const onOpen = React.useCallback(
    async (n: PlatformNotification) => {
      if (n.readAt) return;
      void Haptics.selectionAsync();
      await markNotificationRead(props.authToken, n.id);
      setItems((prev) =>
        prev.map((row) => (row.id === n.id ? { ...row, readAt: new Date().toISOString() } : row))
      );
      const unread = items.filter((row) => row.id !== n.id && !row.readAt).length;
      props.onUnreadCountChange?.(unread);
    },
    [props.authToken, items, props.onUnreadCountChange]
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        topBar: {
          paddingTop: props.topInset + 6,
          paddingHorizontal: t.space.sm,
          paddingBottom: 2
        },
        backBtn: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingRight: 10,
          gap: 2
        },
        pressed: { opacity: 0.85 },
        backLabel: { fontSize: 15, fontWeight: "600", color: t.accentBlue },
        header: {
          paddingHorizontal: t.space.md,
          paddingBottom: t.space.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        },
        title: { fontSize: 26, fontWeight: "900", color: t.text },
        markAll: { fontSize: 14, fontWeight: "700", color: t.accentPurple },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
        err: { color: t.danger, fontWeight: "700", textAlign: "center" },
        empty: { color: t.textMuted, fontWeight: "600", textAlign: "center", marginTop: 8 },
        card: {
          marginHorizontal: t.space.md,
          marginBottom: t.space.sm,
          padding: t.space.md,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        cardUnread: { borderColor: t.accentPurple },
        rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
        cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: t.text },
        when: { fontSize: 12, fontWeight: "600", color: t.textMuted },
        chip: {
          alignSelf: "flex-start",
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
          backgroundColor: t.bgElevated
        },
        chipText: { fontSize: 11, fontWeight: "800", color: t.accentPurple },
        cardBody: { marginTop: 6, fontSize: 14, fontWeight: "600", color: t.textSecondary, lineHeight: 20 }
      }),
    [t, props.topInset]
  );

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable
          onPress={props.onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <BackChevron color={t.accentBlue} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void onMarkAll()} hitSlop={12}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.accentPurple} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: props.bottomInset + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.empty}>No notifications yet.</Text>
              <Text style={[styles.empty, { fontSize: 13, marginTop: 4 }]}>
                Order updates, messages, and team alerts will appear here.
              </Text>
            </View>
          ) : (
            items.map((n) => {
              const unread = !n.readAt;
              return (
                <Pressable
                  key={n.id}
                  style={[styles.card, unread && styles.cardUnread]}
                  onPress={() => void onOpen(n)}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.cardTitle}>{n.title}</Text>
                    <Text style={styles.when}>{formatWhen(n.createdAt)}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{categoryLabel(n.category)}</Text>
                  </View>
                  <Text style={styles.cardBody}>{n.body}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
