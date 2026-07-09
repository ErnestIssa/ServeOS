import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useChatTheme } from "../useChatTheme";

export const CHAT_COMPOSER_PLACEHOLDER = "Message the restaurant…";

const LINE_H = 22;
const FONT_SIZE = 16;
const INPUT_PAD_H = 8;
const INPUT_PAD_V = 10;
const MAX_LINES = 6;
const MIN_COMPOSER_H = LINE_H + INPUT_PAD_V * 2;
const MAX_COMPOSER_H = LINE_H * MAX_LINES + INPUT_PAD_V * 2;

type Props = {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onOpenAttach: () => void;
  pickingImage?: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
};

function composerHeightForValue(text: string): number {
  const lineCount = Math.max(1, text.split("\n").length);
  if (lineCount <= 1) return MIN_COMPOSER_H;
  return Math.min(MAX_COMPOSER_H, lineCount * LINE_H + INPUT_PAD_V * 2);
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  onOpenAttach,
  pickingImage,
  disabled,
  inputRef
}: Props) {
  const { tokens, colors: t, isDark } = useChatTheme();
  const canSend = value.trim().length > 0 && !disabled && !pickingImage;
  const lineCount = Math.max(1, value.split("\n").length);
  const boxHeight = composerHeightForValue(value);
  const atMaxHeight = lineCount >= MAX_LINES;

  const focusInput = React.useCallback(() => {
    inputRef?.current?.focus();
  }, [inputRef]);

  const shellBg = isDark ? t.bgElevated : t.bg;
  const shellBorder = t.border;

  return (
    <View style={[styles.wrap, { borderColor: shellBorder, backgroundColor: shellBg }, shellShadow(tokens)]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attachments"
        disabled={disabled || pickingImage}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenAttach();
        }}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, (disabled || pickingImage) && styles.off]}
      >
        <Text style={[styles.attachGlyph, { color: tokens.brand }]}>📎</Text>
      </Pressable>

      <View style={styles.inputArea}>
        {!value.length ? (
          <Text pointerEvents="none" style={[styles.placeholder, { color: t.textMuted }]} numberOfLines={1}>
            {CHAT_COMPOSER_PLACEHOLDER}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder=""
          placeholderTextColor="transparent"
          style={[
            styles.input,
            { color: t.text, height: boxHeight, maxHeight: MAX_COMPOSER_H },
            Platform.OS === "android" ? styles.inputAndroid : null
          ]}
          multiline
          maxLength={2000}
          editable={!disabled && !pickingImage}
          showSoftInputOnFocus
          onPressIn={focusInput}
          scrollEnabled={atMaxHeight}
          textAlignVertical="top"
          blurOnSubmit={false}
          underlineColorAndroid="transparent"
          accessibilityLabel="Message input"
          {...(Platform.OS === "ios" ? ({ clearButtonMode: "never" as const } as const) : {})}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSend();
        }}
        style={({ pressed }) => [
          styles.sendBtn,
          { backgroundColor: canSend ? tokens.brand : tokens.brandSoft },
          pressed && canSend && styles.pressed,
          !canSend && styles.sendDisabled
        ]}
      >
        <Text style={[styles.sendText, { color: canSend ? tokens.mineText : tokens.brand }]}>↑</Text>
      </Pressable>
    </View>
  );
}

function shellShadow(tokens: { shadow: string }) {
  return {
    shadowColor: tokens.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3
  };
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4
  },
  inputArea: {
    flex: 1,
    minWidth: 0
  },
  placeholder: {
    position: "absolute",
    left: INPUT_PAD_H,
    right: INPUT_PAD_H,
    top: INPUT_PAD_V,
    fontSize: 15,
    lineHeight: LINE_H,
    fontWeight: "600"
  },
  input: {
    width: "100%",
    paddingHorizontal: INPUT_PAD_H,
    paddingTop: INPUT_PAD_V,
    paddingBottom: INPUT_PAD_V,
    fontSize: FONT_SIZE,
    lineHeight: LINE_H,
    fontWeight: "600",
    backgroundColor: "transparent"
  },
  inputAndroid: {
    includeFontPadding: false,
    textBreakStrategy: "simple"
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20
  },
  attachGlyph: { fontSize: 20 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  sendText: { fontSize: 20, fontWeight: "900", marginTop: -2 },
  sendDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.88 },
  off: { opacity: 0.42 }
});
