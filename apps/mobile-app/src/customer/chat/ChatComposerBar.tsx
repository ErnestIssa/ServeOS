import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { R } from "../../theme";
import { CHAT } from "./chatTheme";
import { ChatIconCamera } from "./ChatIconCamera";

export const CHAT_COMPOSER_PLACEHOLDER = "Message the restaurant…";

const SEND_BTN_W = 76;
const SHELL_PAD = 4;

type Props = {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onPickImages: () => void;
  sending: boolean;
  pickingImage?: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
};

export function ChatComposerBar({
  value,
  onChange,
  onSend,
  onPickImages,
  sending,
  pickingImage,
  disabled,
  inputRef
}: Props) {
  const showPlaceholder = value.length === 0;
  const hasText = value.trim().length > 0;
  const canSend = hasText && !sending && !disabled && !pickingImage;
  const showCamera = !hasText;

  const focusInput = React.useCallback(() => {
    inputRef?.current?.focus();
  }, [inputRef]);

  return (
    <View style={styles.wrap}>
      <View style={styles.shell}>
        <Pressable
          style={({ pressed }) => [styles.inputArea, pressed && styles.inputAreaPressed]}
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
            editable={!disabled && !pickingImage}
            showSoftInputOnFocus
            onPressIn={focusInput}
            blurOnSubmit={false}
            {...(Platform.OS === "ios" ? ({ clearButtonMode: "never" as const } as const) : {})}
          />
        </Pressable>
        {showCamera ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.cameraBtn,
              pressed && styles.pressed,
              (pickingImage || disabled) && styles.actionOff
            ]}
            disabled={pickingImage || disabled}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPickImages();
            }}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            {pickingImage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ChatIconCamera color="#fff" size={22} />
            )}
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.send,
              pressed && styles.pressed,
              !canSend && styles.actionOff
            ]}
            disabled={!canSend}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSend();
            }}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    backgroundColor: "transparent"
  },
  shell: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 52,
    maxHeight: 136,
    padding: SHELL_PAD,
    borderWidth: 2,
    borderColor: "#7C3AED",
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3
  },
  inputArea: {
    flex: 1,
    minHeight: 44,
    maxHeight: 124,
    justifyContent: "center"
  },
  inputAreaPressed: { opacity: 0.96 },
  placeholderOverlay: {
    position: "absolute",
    left: 14,
    right: SEND_BTN_W + 10,
    top: 12,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: R.textMuted,
    zIndex: 0
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: "700",
    color: R.text,
    backgroundColor: "transparent",
    zIndex: 1
  },
  actionBtn: {
    width: SEND_BTN_W,
    height: 44,
    marginLeft: 4,
    borderRadius: R.radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraBtn: {
    backgroundColor: CHAT.brand
  },
  send: {
    backgroundColor: CHAT.brand
  },
  actionOff: { opacity: 0.45 },
  sendText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
  pressed: { opacity: 0.92 }
});
