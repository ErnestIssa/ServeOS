import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassChip } from "./GlassChip";
import { REACTION_PAGES } from "./chatReactions";
import { hapticSelection } from "./haptics";
import { radius, spacing } from "./theme";

type Props = {
  onPick: (emoji: string) => void;
  onOpenFullPicker: () => void;
  onClose: () => void;
};

export function ChatReactionBar({ onPick, onOpenFullPicker, onClose }: Props) {
  const [page, setPage] = useState(0);
  const emojis = REACTION_PAGES[page] ?? REACTION_PAGES[0];
  const hasNext = page < REACTION_PAGES.length - 1;

  return (
    <View style={styles.root}>
      <GlassChip style={styles.bar}>
        <View style={styles.row}>
          {emojis.map((emoji) => (
            <Pressable
              key={emoji}
              style={styles.emojiBtn}
              onPress={() => {
                hapticSelection();
                onPick(emoji);
                onClose();
              }}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}

          {hasNext ? (
            <Pressable
              style={styles.emojiBtn}
              onPress={() => {
                hapticSelection();
                setPage((p) => p + 1);
              }}
            >
              <Ionicons name="chevron-forward" size={18} color="#667781" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.plusBtn}
              onPress={() => {
                hapticSelection();
                onOpenFullPicker();
              }}
            >
              <Ionicons name="add" size={20} color="#175F61" />
            </Pressable>
          )}
        </View>
      </GlassChip>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 100
  },
  bar: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  emojiBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full
  },
  emoji: { fontSize: 22 },
  plusBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: "rgba(23,95,97,0.12)"
  }
});
