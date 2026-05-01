import React from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

export type AllowedCountry = "Sweden" | "Norway" | "Denmark" | "Finland";

export type CountryOption = {
  name: AllowedCountry;
  flag: string;
  dialCode: string;
};

export const NORDIC_COUNTRIES: ReadonlyArray<CountryOption> = [
  { name: "Sweden", flag: "🇸🇪", dialCode: "+46" },
  { name: "Norway", flag: "🇳🇴", dialCode: "+47" },
  { name: "Denmark", flag: "🇩🇰", dialCode: "+45" },
  { name: "Finland", flag: "🇫🇮", dialCode: "+358" }
];

type Props = {
  value: AllowedCountry;
  onChange: (c: AllowedCountry) => void;
  label?: string;
  disabled?: boolean;
  locked?: boolean;
};

export function CountrySelect({ value, onChange, label = "Country", disabled, locked }: Props) {
  const [open, setOpen] = React.useState(false);
  const sheetOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetY = React.useRef(new Animated.Value(12)).current;

  const selected = React.useMemo(() => NORDIC_COUNTRIES.find((c) => c.name === value) ?? NORDIC_COUNTRIES[0], [value]);

  const close = () => {
    setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return;
    sheetOpacity.setValue(0);
    sheetY.setValue(12);
    Animated.parallel([
      Animated.timing(sheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: 0, duration: 280, useNativeDriver: true })
    ]).start();
  }, [open, sheetOpacity, sheetY]);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => {
          if (disabled || locked) return;
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.pill,
          pressed && !disabled && !locked && { opacity: 0.95 },
          disabled && !locked && { opacity: 0.6 },
          locked && { opacity: 1 }
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled || locked) }}
      >
        <Text style={styles.pillText} numberOfLines={1}>
          {selected.flag} {selected.name} · {selected.dialCode}
        </Text>
        {locked ? <Text style={styles.lockIcon}>🔒</Text> : <Text style={styles.chev}>▼</Text>}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalRoot}>
          <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />

          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          >
            <Animated.View style={[styles.sheet, { opacity: sheetOpacity, transform: [{ translateY: sheetY }] }]}>
              <Text style={styles.sheetTitle}>Select country</Text>

              <View style={styles.grid}>
                {NORDIC_COUNTRIES.map((c) => {
                  const on = c.name === value;
                  return (
                    <Pressable
                      key={c.name}
                      onPress={() => {
                        onChange(c.name);
                        close();
                      }}
                      style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && { opacity: 0.96 }]}
                    >
                      <Text style={styles.cardFlag}>{c.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{c.name}</Text>
                        <Text style={styles.cardMeta}>{c.dialCode}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 14, marginBottom: 8, color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "900" },
  pill: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.20)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  pillText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", flex: 1 },
  chev: { color: "rgba(255,255,255,0.65)", fontWeight: "900", marginLeft: 10 },
  lockIcon: { fontSize: 13, lineHeight: 16, marginLeft: 10 },
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  sheet: {
    width: "92%",
    maxWidth: 380,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  sheetTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", textAlign: "center" },
  grid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  card: {
    width: "44%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  cardOn: { backgroundColor: "rgba(255,255,255,0.12)" },
  cardFlag: { fontSize: 30 },
  cardName: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  cardMeta: { marginTop: 4, color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "900" }
});

