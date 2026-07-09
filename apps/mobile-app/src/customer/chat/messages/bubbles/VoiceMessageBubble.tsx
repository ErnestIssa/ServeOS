import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import type { ChatMessageViewModel } from "../types";
import { MessageMeta } from "../parts/MessageMeta";

type Props = {
  message: ChatMessageViewModel;
  timeUnread?: boolean;
};

/** Voice message player shell — playback wiring comes with media backend. */
export const VoiceMessageBubble = React.memo(function VoiceMessageBubble({ message, timeUnread }: Props) {
  const { tokens, colors: t } = useChatTheme();
  const [playing, setPlaying] = React.useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.playerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
        onPress={() => setPlaying((p) => !p)}
        style={[
          styles.playBtn,
          { backgroundColor: message.mine ? tokens.mineText : tokens.brandSoft, borderColor: message.mine ? tokens.mineMeta : t.border }
        ]}
      >
        <Text style={{ color: message.mine ? tokens.brand : tokens.brand, fontWeight: "900" }}>
          {playing ? "❚❚" : "▶"}
        </Text>
      </Pressable>
      <View style={styles.waveCol}>
        <View style={styles.waveRow}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: 6 + (i % 5) * 4,
                  backgroundColor: message.mine ? tokens.mineMeta : tokens.brand,
                  opacity: playing && i % 3 === 0 ? 1 : 0.55
                }
              ]}
            />
          ))}
        </View>
        <Text style={[styles.duration, { color: message.mine ? tokens.mineMeta : t.textMuted }]}>0:12</Text>
      </View>
      </View>
      <MessageMeta message={message} showStatus={message.mine} timeUnread={timeUnread} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { minWidth: 220, gap: 6 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start"
  },
  waveCol: { flex: 1, gap: 4 },
  waveRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 28 },
  bar: { width: 3, borderRadius: 2 },
  duration: { fontSize: 11, fontWeight: "700" }
});
