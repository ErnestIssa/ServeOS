import * as Haptics from "expo-haptics";
import React from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonListRows } from "../components/skeleton/SkeletonUi";
import { ScreenErrorState } from "../errors";
import { contentBottomInset, contentTopInsetWithoutTopNav, FLOAT_MARGIN_SIDE } from "../shell/navBottomMetrics";
import { R } from "../theme";
import { useAppTheme } from "../theme/AppThemeContext";
import {
  fetchCustomerChatOverview,
  type CustomerChatActivityItem,
  type CustomerChatOverviewThread
} from "./customerChatApi";
import { subscribeChatRelay } from "./chat/customerChatSocket";

const PREVIEW_MAX = 72;

type Props = {
  token: string;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  onScrollEndDrag?: () => void;
  onMomentumScrollEnd?: () => void;
  focused: boolean;
  onOpenThread: (restaurantId: string) => void;
  onUnreadCountChange?: (count: number) => void;
};

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Now";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (ms < 86_400_000) return `${Math.max(1, Math.floor(ms / 3_600_000))}h`;
  return `${Math.max(1, Math.floor(ms / 86_400_000))}d`;
}

function truncatePreview(text: string, max = PREVIEW_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function ThreadPreview({ thread }: { thread: CustomerChatOverviewThread }) {
  const preview = thread.lastMessagePreview?.trim();
  if (!preview) {
    return (
      <Text style={styles.previewMuted} numberOfLines={1}>
        {thread.activeOrder
          ? `${thread.activeOrder.statusEmoji} ${thread.activeOrder.statusLabel} in progress`
          : "Tap to open conversation"}
      </Text>
    );
  }

  if (thread.hasUnread) {
    return (
      <View style={styles.previewUnreadRow}>
        <Text style={styles.newBadge}>New</Text>
        <Text style={styles.previewUnread} numberOfLines={1}>
          {truncatePreview(preview, 48)}
        </Text>
      </View>
    );
  }

  return (
    <Text style={styles.previewRead} numberOfLines={1}>
      {truncatePreview(preview)}
    </Text>
  );
}

function ChatThreadRow({
  thread,
  onPress
}: {
  thread: CustomerChatOverviewThread;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.threadRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${thread.restaurantName}`}
    >
      <View style={styles.threadAvatar}>
        <Text style={styles.threadAvatarText}>{thread.restaurantName.trim().charAt(0).toUpperCase()}</Text>
        {thread.hasUnread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.threadBody}>
        <View style={styles.threadTop}>
          <Text style={styles.threadTitle} numberOfLines={1}>
            {thread.restaurantName}
          </Text>
          <Text style={styles.threadTime}>{formatRelativeTime(thread.lastMessageAt)}</Text>
        </View>
        {thread.activeOrder ? (
          <Text style={styles.threadMeta} numberOfLines={1}>
            {thread.activeOrder.statusEmoji} Order #{thread.activeOrder.shortLabel} · {thread.activeOrder.statusLabel}
          </Text>
        ) : null}
        <ThreadPreview thread={thread} />
      </View>
    </Pressable>
  );
}

function ActivityRow({
  item,
  onPress
}: {
  item: CustomerChatActivityItem;
  onPress: () => void;
}) {
  const icon = item.kind === "order_update" ? "📦" : item.kind === "message" ? "💬" : "✨";
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.activityIconWrap}>
        <Text style={styles.activityIcon}>{icon}</Text>
      </View>
      <View style={styles.activityBody}>
        <View style={styles.threadTop}>
          <Text style={styles.activityTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.threadTime}>{formatRelativeTime(item.at)}</Text>
        </View>
        <Text style={styles.activityVenue} numberOfLines={1}>
          {item.restaurantName}
        </Text>
        {item.subtitle ? (
          item.hasUnread ? (
            <View style={styles.previewUnreadRow}>
              <Text style={styles.newBadge}>New</Text>
              <Text style={styles.previewUnread} numberOfLines={1}>
                {truncatePreview(item.subtitle, 44)}
              </Text>
            </View>
          ) : (
            <Text style={styles.previewRead} numberOfLines={1}>
              {truncatePreview(item.subtitle)}
            </Text>
          )
        ) : null}
      </View>
    </Pressable>
  );
}

export function CustomerChatOverviewScreen({
  token,
  scrollY,
  onScroll,
  onScrollEndDrag,
  onMomentumScrollEnd,
  focused,
  onOpenThread,
  onUnreadCountChange
}: Props) {
  const { colors: theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = React.useState<CustomerChatOverviewThread[]>([]);
  const [activity, setActivity] = React.useState<CustomerChatActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const loadGenRef = React.useRef(0);

  const loadOverview = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      const gen = ++loadGenRef.current;
      if (!opts?.silent) setLoading(true);
      setLoadErr(null);
      try {
        const res = await fetchCustomerChatOverview(token);
        if (gen !== loadGenRef.current) return;
        if (!res.ok) {
          setLoadErr(res.error ?? "Could not load chats");
          return;
        }
        setThreads(res.threads ?? []);
        setActivity(res.activity ?? []);
        onUnreadCountChange?.(res.totalUnread ?? 0);
      } catch {
        if (gen !== loadGenRef.current) return;
        setLoadErr("Could not load chats");
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, onUnreadCountChange]
  );

  React.useEffect(() => {
    if (!focused) return;
    void loadOverview();
  }, [focused, loadOverview]);

  React.useEffect(() => {
    if (!focused) return;
    const off = subscribeChatRelay(() => {
      void loadOverview({ silent: true });
    });
    return off;
  }, [focused, loadOverview]);

  const topPad = contentTopInsetWithoutTopNav(insets.top);
  const bottomPad = contentBottomInset(insets.bottom);
  const screenPad = { paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: FLOAT_MARGIN_SIDE };

  if (loading && threads.length === 0 && !loadErr) {
    return (
      <View style={[styles.shell, screenPad]}>
        <Text style={[styles.heroTitle, { color: theme.ordersNavPurpleBright }]}>Messages</Text>
        <SkeletonListRows count={5} style={{ marginTop: 18 }} />
      </View>
    );
  }

  if (loadErr && threads.length === 0) {
    return (
      <View style={[styles.shell, screenPad]}>
        <ScreenErrorState message={loadErr} onRetry={() => void loadOverview()} />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={styles.shell}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: FLOAT_MARGIN_SIDE }
      ]}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadOverview({ silent: true });
          }}
        />
      }
    >
      <Text style={[styles.heroTitle, { color: theme.ordersNavPurpleBright }]}>Messages</Text>
      <Text style={styles.heroSub}>Venue chats, live orders, and updates in one place.</Text>

      <Text style={styles.sectionLabel}>Conversations</Text>
      {threads.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyBody}>
            Place an order or pick a venue to start chatting with the restaurant team.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {threads.map((thread, i) => (
            <React.Fragment key={`${thread.restaurantId}:${thread.chatRoomId ?? "new"}`}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <ChatThreadRow thread={thread} onPress={() => onOpenThread(thread.restaurantId)} />
            </React.Fragment>
          ))}
        </View>
      )}

      <Text style={[styles.sectionLabel, styles.sectionGap]}>Recent activity</Text>
      {activity.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyBody}>Order updates and venue actions will show up here.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {activity.map((item, i) => (
            <React.Fragment key={item.id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <ActivityRow item={item} onPress={() => onOpenThread(item.restaurantId)} />
            </React.Fragment>
          ))}
        </View>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: {},
  heroTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 38
  },
  heroSub: {
    marginTop: 8,
    fontSize: R.type.body,
    lineHeight: 22,
    color: R.textSecondary,
    fontWeight: "500"
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: R.type.label,
    fontWeight: "900",
    color: R.text,
    letterSpacing: 0.15
  },
  sectionGap: { marginTop: 28 },
  card: {
    borderRadius: R.radius.card,
    backgroundColor: R.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: R.border,
    overflow: "hidden"
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  threadAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(124,58,237,0.14)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  threadAvatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: R.accentPurple
  },
  unreadDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: R.bgElevated
  },
  threadBody: { flex: 1, minWidth: 0, gap: 4 },
  threadTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  threadTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: R.type.body,
    fontWeight: "800",
    color: R.text
  },
  threadTime: {
    fontSize: R.type.caption,
    fontWeight: "700",
    color: R.textMuted
  },
  threadMeta: {
    fontSize: R.type.caption,
    fontWeight: "700",
    color: R.ordersNavPurple
  },
  previewUnreadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0
  },
  newBadge: {
    fontSize: 11,
    fontWeight: "900",
    color: "#22C55E",
    letterSpacing: 0.2,
    textTransform: "uppercase"
  },
  previewUnread: {
    flex: 1,
    minWidth: 0,
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.textMuted,
    opacity: 0.55
  },
  previewRead: {
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.textSecondary,
    lineHeight: 18
  },
  previewMuted: {
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.textMuted,
    fontStyle: "italic"
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: R.bgSubtle,
    alignItems: "center",
    justifyContent: "center"
  },
  activityIcon: { fontSize: 18 },
  activityBody: { flex: 1, minWidth: 0, gap: 3 },
  activityTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: R.type.label,
    fontWeight: "800",
    color: R.text
  },
  activityVenue: {
    fontSize: R.type.caption,
    fontWeight: "700",
    color: R.textMuted
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: R.border,
    marginLeft: 72
  },
  emptyCard: {
    borderRadius: R.radius.card,
    backgroundColor: R.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: R.border,
    padding: R.space.md
  },
  emptyTitle: {
    fontSize: R.type.label,
    fontWeight: "900",
    color: R.text,
    marginBottom: 6
  },
  emptyBody: {
    fontSize: R.type.body,
    lineHeight: 22,
    color: R.textSecondary,
    fontWeight: "600"
  },
  pressed: { opacity: 0.88 }
});
