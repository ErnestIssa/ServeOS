import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassChip } from "./GlassChip";
import { ALL_REACTIONS } from "./chatReactions";
import { hapticSelection, hapticSuccess } from "./haptics";
import { PressableScale } from "./PressableScale";
import { radius, spacing } from "./theme";

type Props = {
  open: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

export function ChatReactionPickerModal({ open, onPick, onClose }: Props) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close reactions" />

        <GlassChip style={styles.card} intensity={92}>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <View style={styles.grid}>
              {ALL_REACTIONS.map((emoji) => (
                <PressableScale
                  key={emoji}
                  style={styles.cell}
                  haptic="selection"
                  onPress={() => {
                    hapticSelection();
                    onPick(emoji);
                    hapticSuccess();
                    onClose();
                  }}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </PressableScale>
              ))}
            </View>
          </ScrollView>
        </GlassChip>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)"
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.sm,
    width: "100%",
    maxWidth: 268,
    maxHeight: 300
  },
  scroll: { maxHeight: 280 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs
  },
  cell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  emoji: { fontSize: 26 }
});
