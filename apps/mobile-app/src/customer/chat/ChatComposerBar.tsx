import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { R } from "../../theme";
import { CHAT } from "./chatTheme";

export const CHAT_COMPOSER_PLACEHOLDER = "Message the restaurant…";

type Props = {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
};

export function ChatComposerBar({ value, onChange, onSend, sending, disabled, inputRef }: Props) {
  const showPlaceholder = value.length === 0;

  const focusInput = React.useCallback(() => {
    inputRef?.current?.focus();
  }, [inputRef]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.inputWrap, pressed && styles.inputWrapPressed]}
          onPress={focusInput}
          accessibilityRole="button"
          accessibilityLabel={CHAT_COMPOSER_PLACEHOLDER}
        >
          {showPlaceholder ? (
            <Text pointerEvents="none" style={styles.placeholderOverlay} numberOfLines={2}>
              {CHAT_COMPOSER_PLACEHOLDER}
            </Text>
          ) : null}
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            placeholder=""
            placeholderTextColor="transparent"
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!disabled}
            showSoftInputOnFocus
            onPressIn={focusInput}
            blurOnSubmit={false}
            {...(Platform.OS === "ios" ? ({ clearButtonMode: "never" as const } as const) : {})}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.send,
            pressed && styles.pressed,
            (!value.trim() || sending || disabled) && styles.sendOff
          ]}
          disabled={!value.trim() || sending || disabled}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSend();
          }}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "transparent"
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  inputWrap: {
    flex: 1,
    minHeight: 52,
    maxHeight: 128,
    borderWidth: 2,
    borderColor: "#7C3AED",
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    justifyContent: "center",
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3
  },
  inputWrapPressed: { opacity: 0.96 },
  placeholderOverlay: {
    position: "absolute",
    left: 18,
    right: 14,
    top: 14,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: R.textMuted,
    zIndex: 0
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: "700",
    color: R.text,
    backgroundColor: "transparent",
    zIndex: 1
  },
  send: {
    minWidth: 84,
    height: 52,
    borderRadius: R.radius.pill,
    backgroundColor: CHAT.brand,
    borderWidth: 2,
    borderColor: "#5B21B6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  sendOff: { opacity: 0.5 },
  sendText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  pressed: { opacity: 0.92 }
});
