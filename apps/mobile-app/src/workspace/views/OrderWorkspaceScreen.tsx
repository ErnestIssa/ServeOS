import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDisplayMoney } from "../../formatMoney";
import { useAppTheme } from "../../theme/AppThemeContext";
import { API_URL } from "../../api";
import {
  fetchOrderOcl,
  fetchReservationOcl,
  postOrderOclMessage,
  postOrderOclStatus,
  postReservationOclMessage,
  postReservationOclStatus,
  type OperationalEntityType,
  type OrderOclThread
} from "../../mobile/workspaceApi";
import { subscribeOclEntity } from "../workspaceOclSocket";

export type OclWorkspaceTarget = { entityType: OperationalEntityType; entityId: string } | null;

type Props = {
  visible: boolean;
  target: OclWorkspaceTarget;
  authToken: string;
  onClose: () => void;
  onChanged?: () => void;
};

export function OrderWorkspaceScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [thread, setThread] = React.useState<OrderOclThread | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const target = props.target;

  const load = React.useCallback(async () => {
    if (!target || !props.authToken) return;
    setLoading(true);
    setErr(null);
    const res =
      target.entityType === "order"
        ? await fetchOrderOcl(props.authToken, target.entityId)
        : await fetchReservationOcl(props.authToken, target.entityId);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error ?? "Could not load workspace");
      setThread(null);
      return;
    }
    setThread(res.thread);
  }, [target, props.authToken]);

  React.useEffect(() => {
    if (!props.visible || !target) {
      setThread(null);
      setDraft("");
      setErr(null);
      return;
    }
    void load();
    const unsub =
      target.entityType === "order"
        ? subscribeOclEntity(API_URL, "order", target.entityId, () => void load())
        : () => undefined;
    return unsub;
  }, [props.visible, target, load]);

  const runAction = async (nextStatus: string) => {
    if (!target || busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    const res =
      target.entityType === "order"
        ? await postOrderOclStatus(props.authToken, target.entityId, nextStatus, { announceInChat: true })
        : await postReservationOclStatus(props.authToken, target.entityId, nextStatus);
    setBusy(false);
    if (res.ok) {
      setThread(res.thread);
      props.onChanged?.();
    }
  };

  const send = async () => {
    if (!target || !draft.trim() || busy || !thread?.canSendMessage) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    const res =
      target.entityType === "order"
        ? await postOrderOclMessage(props.authToken, target.entityId, draft.trim())
        : await postReservationOclMessage(props.authToken, target.entityId, draft.trim());
    setBusy(false);
    if (res.ok) {
      setDraft("");
      setThread(res.thread);
      props.onChanged?.();
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: t.bg },
        header: {
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.border
        },
        back: { color: t.accentBlue, fontWeight: "700", marginBottom: 8 },
        title: { fontSize: 22, fontWeight: "900", color: t.text },
        badge: {
          alignSelf: "flex-start",
          marginTop: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: `${t.accentPurple}22`
        },
        badgeText: { fontWeight: "800", color: t.accentPurple, fontSize: 13 },
        meta: { marginTop: 6, fontSize: 14, color: t.textSecondary, fontWeight: "600" },
        section: { paddingHorizontal: 16, paddingVertical: 12 },
        sectionLabel: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.6,
          color: t.textMuted,
          marginBottom: 8,
          textTransform: "uppercase"
        },
        timelineRow: {
          flexDirection: "row",
          gap: 10,
          marginBottom: 10,
          alignItems: "flex-start"
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: t.accentPurple,
          marginTop: 5
        },
        timelineTitle: { fontSize: 14, fontWeight: "700", color: t.text, flex: 1 },
        timelineAt: { fontSize: 11, color: t.textMuted, marginTop: 2 },
        line: { fontSize: 14, color: t.text, marginBottom: 4, fontWeight: "600" },
        bubble: {
          maxWidth: "88%",
          padding: 10,
          borderRadius: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        bubbleMine: { alignSelf: "flex-end", backgroundColor: `${t.accentPurple}28` },
        bubbleOther: { alignSelf: "flex-start" },
        actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
        actionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
        actionPrimary: { backgroundColor: t.accentPurple },
        actionSecondary: { backgroundColor: t.bgElevated, borderWidth: 1, borderColor: t.border },
        composer: {
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 12,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: t.border,
          alignItems: "flex-end"
        },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: t.text,
          maxHeight: 96
        },
        send: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: t.accentPurple }
      }),
    [t, insets.top, insets.bottom]
  );

  const h = thread?.header as Record<string, unknown> | undefined;
  const titlePrefix = target?.entityType === "reservation" ? "Reservation" : "Order";

  return (
    <Modal visible={props.visible && !!target} animationType="slide" onRequestClose={props.onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressable onPress={props.onClose} hitSlop={12}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          {loading && !thread ? (
            <ActivityIndicator color={t.accentPurple} style={{ marginTop: 24 }} />
          ) : err ? (
            <Text style={{ color: t.danger, marginTop: 16, fontWeight: "700" }}>{err}</Text>
          ) : h ? (
            <>
              <Text style={styles.title}>
                {titlePrefix} #{String(h.shortId ?? "")}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{String(h.statusLabel ?? "")}</Text>
              </View>
              <Text style={styles.meta}>
                {String(h.customerLabel ?? "")}
                {typeof h.elapsedMinutes === "number" ? ` · ${h.elapsedMinutes}m` : ""}
                {typeof h.totalCents === "number" ? ` · ${formatDisplayMoney(h.totalCents)}` : ""}
                {typeof h.startsAt === "string" ? ` · ${new Date(h.startsAt).toLocaleString()}` : ""}
              </Text>
              {h.note ? (
                <Text style={[styles.meta, { fontStyle: "italic" }]}>{String(h.note)}</Text>
              ) : null}
            </>
          ) : null}
        </View>

        {thread ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Timeline</Text>
              {thread.timeline.map((ev) => (
                <View key={ev.id} style={styles.timelineRow}>
                  <View style={styles.dot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{ev.title}</Text>
                    {ev.detail ? (
                      <Text style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{ev.detail}</Text>
                    ) : null}
                    <Text style={styles.timelineAt}>{new Date(ev.at).toLocaleTimeString()}</Text>
                  </View>
                </View>
              ))}
            </View>

            {thread.lines.length > 0 ? (
              <View style={[styles.section, { paddingTop: 0 }]}>
                <Text style={styles.sectionLabel}>Items</Text>
                {thread.lines.map((l) => (
                  <Text key={l.id} style={styles.line}>
                    {l.quantity}× {l.name} · {formatDisplayMoney(l.lineTotalCents)}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={{ flex: 1, minHeight: 120 }}>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 16 }]}>Chat</Text>
              <FlatList
                data={thread.messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                renderItem={({ item: m }) => (
                  <View style={[styles.bubble, m.isMine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={{ fontSize: 11, color: t.textMuted, fontWeight: "700", marginBottom: 4 }}>
                      {m.senderRole}
                    </Text>
                    <Text style={{ color: t.text, fontWeight: "600" }}>{m.content}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={{ color: t.textMuted, fontWeight: "600" }}>No messages yet for this order.</Text>
                }
              />
            </View>

            {thread.canUpdateStatus && thread.actions.length > 0 ? (
              <View style={styles.actions}>
                {thread.actions.map((a) => (
                  <Pressable
                    key={a.id}
                    disabled={busy}
                    style={[
                      styles.actionBtn,
                      a.variant === "primary" ? styles.actionPrimary : styles.actionSecondary
                    ]}
                    onPress={() => void runAction(a.nextStatus)}
                  >
                    <Text
                      style={{
                        color: a.variant === "primary" ? "#fff" : t.text,
                        fontWeight: "800",
                        fontSize: 13
                      }}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {thread.canSendMessage ? (
              <View style={styles.composer}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Message customer…"
                  placeholderTextColor={t.textMuted}
                  multiline
                  editable={!busy}
                />
                <Pressable style={styles.send} onPress={() => void send()} disabled={busy}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Send</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
