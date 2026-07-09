import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../useChatTheme";
import type { ChatMessageViewModel } from "../messages/types";

type Props = {
  visible: boolean;
  message: ChatMessageViewModel | null;
  onClose: () => void;
  onCopy?: () => void;
  onReply?: () => void;
  onDelete?: () => void;
};

export function MessageActionMenu({ visible, message, onClose, onCopy, onReply, onDelete }: Props) {
  const { tokens, colors: t } = useChatTheme();
  if (!message) return null;

  const actions = [
    { key: "copy", label: "Copy", onPress: onCopy },
    { key: "reply", label: "Reply", onPress: onReply },
    { key: "delete", label: "Delete", onPress: onDelete, danger: true }
  ].filter((a) => a.onPress);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: `${t.text}59` }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      >
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => {
                action.onPress?.();
                onClose();
              }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
            >
              <Text style={[styles.label, { color: action.danger ? t.danger : t.text }]}>{action.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={[styles.cancel, { borderTopColor: t.border }]}>
            <Text style={[styles.label, { color: tokens.brand }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    margin: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden"
  },
  row: { paddingVertical: 16, paddingHorizontal: 18 },
  label: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  cancel: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth }
});
