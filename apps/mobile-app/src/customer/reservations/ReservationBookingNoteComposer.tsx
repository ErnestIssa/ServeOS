import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { R } from "../../theme";
import { useAppTheme } from "../../theme/AppThemeContext";

export const BOOKING_NOTE_PLACEHOLDER =
  "Optional — tell us about allergies, a celebration, seating wishes, or timing so the restaurant can take great care of your visit.";
export const BOOKING_NOTE_MAX_LENGTH = 500;

type Props = {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
};

/**
 * Chat-style multiline composer (no send/camera) — matches booking card chrome.
 */
export function ReservationBookingNoteComposer({ value, onChange, disabled, inputRef }: Props) {
  const { colors: t } = useAppTheme();
  const showPlaceholder = value.length === 0;

  const focusInput = React.useCallback(() => {
    if (disabled) return;
    inputRef?.current?.focus();
  }, [disabled, inputRef]);

  const borderColor = t.ordersNavPurpleBright;
  const shellBg = "rgba(255,255,255,0.94)";

  return (
    <View style={styles.wrap}>
      <View style={[styles.shell, { borderColor, backgroundColor: shellBg }]}>
        <Pressable
          style={({ pressed }) => [styles.inputArea, pressed && !disabled && styles.inputAreaPressed]}
          onPress={focusInput}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={BOOKING_NOTE_PLACEHOLDER}
        >
          {showPlaceholder ? (
            <Text pointerEvents="none" style={[styles.placeholderOverlay, { color: t.textSecondary }]} numberOfLines={5}>
              {BOOKING_NOTE_PLACEHOLDER}
            </Text>
          ) : null}
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            placeholder=""
            placeholderTextColor="transparent"
            style={[styles.input, { color: t.text }]}
            multiline
            maxLength={BOOKING_NOTE_MAX_LENGTH}
            editable={!disabled}
            showSoftInputOnFocus
            onPressIn={focusInput}
            blurOnSubmit={false}
            textAlignVertical="top"
            {...(Platform.OS === "ios" ? ({ clearButtonMode: "never" as const } as const) : {})}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%"
  },
  shell: {
    width: "100%",
    minHeight: 132,
    maxHeight: 220,
    padding: 4,
    borderWidth: 2,
    borderRadius: R.radius.input,
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2
  },
  inputArea: {
    flex: 1,
    minHeight: 124,
    maxHeight: 208,
    justifyContent: "flex-start"
  },
  inputAreaPressed: { opacity: 0.96 },
  placeholderOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 12,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    zIndex: 0
  },
  input: {
    flex: 1,
    minHeight: 124,
    maxHeight: 204,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 17,
    fontWeight: "600",
    backgroundColor: "transparent",
    zIndex: 1
  }
});
