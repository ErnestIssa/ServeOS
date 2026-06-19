import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { fetchVenueChatMessages, sendVenueChatMessage } from "../../mobile/workspaceApi";

type Thread = {
  id: string;
  type: string;
  orderId: string | null;
  reservationId?: string | null;
  customerLabel: string;
  preview: string;
  lastMessageAt: string;
  unreadForVenue: boolean;
};

type Props = {
  authToken: string;
  restaurantId: string;
  threads: Thread[];
  onReload: () => void;
  onOpenOrder?: (orderId: string) => void;
  onOpenReservation?: (reservationId: string) => void;
};

export function StaffChatView(props: Props) {
  const { colors: t } = useAppTheme();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const openThread = React.useCallback(
    async (id: string) => {
      setActiveId(id);
      setLoading(true);
      const res = await fetchVenueChatMessages(props.authToken, props.restaurantId, id);
      setLoading(false);
      if (res.ok) setMessages(res.messages);
    },
    [props.authToken, props.restaurantId]
  );

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await sendVenueChatMessage(props.authToken, props.restaurantId, activeId, draft.trim());
    if (res.ok) {
      setDraft("");
      await openThread(activeId);
      props.onReload();
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        thread: {
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: t.border,
          marginBottom: 8,
          backgroundColor: t.bgElevated
        },
        threadUnread: { borderColor: t.accentPurple },
        name: { fontSize: 16, fontWeight: "800", color: t.text },
        preview: { marginTop: 4, fontSize: 13, color: t.textSecondary },
        composer: {
          flexDirection: "row",
          gap: 8,
          marginTop: 12,
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
          maxHeight: 100
        },
        send: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: t.accentPurple
        },
        bubble: {
          alignSelf: "flex-start",
          maxWidth: "85%",
          padding: 10,
          borderRadius: 12,
          marginBottom: 8,
          backgroundColor: t.bgElevated,
          borderWidth: 1,
          borderColor: t.border
        },
        bubbleMine: { alignSelf: "flex-end", backgroundColor: `${t.accentPurple}33` }
      }),
    [t]
  );

  if (!activeId) {
    return (
      <>
        {props.threads.length === 0 ? (
          <Text style={{ textAlign: "center", marginTop: 24, color: t.textMuted }}>No conversations yet.</Text>
        ) : (
          props.threads.map((th) => (
            <Pressable
              key={th.id}
              style={[styles.thread, th.unreadForVenue && styles.threadUnread]}
              onPress={() => {
                if (th.type === "ORDER" && th.orderId && props.onOpenOrder) {
                  props.onOpenOrder(th.orderId);
                  return;
                }
                if (th.type === "RESERVATION" && th.reservationId && props.onOpenReservation) {
                  props.onOpenReservation(th.reservationId);
                  return;
                }
                void openThread(th.id);
              }}
            >
              <Text style={styles.name}>
                {th.type === "ORDER"
                  ? "Order workspace"
                  : th.type === "RESERVATION"
                    ? "Reservation workspace"
                    : th.type}{" "}
                · {th.customerLabel}
              </Text>
              <Text style={styles.preview} numberOfLines={2}>
                {(th.type === "ORDER" && th.orderId) || (th.type === "RESERVATION" && th.reservationId)
                  ? "Open unified timeline, chat & actions"
                  : th.preview}
              </Text>
            </Pressable>
          ))
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={() => setActiveId(null)}>
        <Text style={{ color: t.accentBlue, fontWeight: "700", marginBottom: 12 }}>← Conversations</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator color={t.accentPurple} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m: any) => m.id}
          renderItem={({ item: m }: { item: any }) => (
            <View style={[styles.bubble, m.senderRole !== "CUSTOMER" && styles.bubbleMine]}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{m.content}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Message…"
                placeholderTextColor={t.textMuted}
                multiline
              />
              <Pressable style={styles.send} onPress={() => void send()}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Send</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}
