import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";
import type { ChatMessageViewModel } from "../types";

type Props = {
  message: ChatMessageViewModel;
  onRetry?: () => void;
};

export const FailedBubble = React.memo(function FailedBubble({ message, onRetry }: Props) {
  const { colors: t } = useChatTheme();
  return (
    <View>
      <Text style={[styles.text, { color: t.danger }]}>Message failed to send</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry send">
          <Text style={[styles.retry, { color: t.accentBlue }]}>Tap to retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: 14, fontWeight: "700" },
  retry: { marginTop: 4, fontSize: 13, fontWeight: "800" }
});
