import React from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import type { AllowedCountry } from "./CountrySelect";

export type CityOption = { country: AllowedCountry; name: string };

const CITIES: ReadonlyArray<CityOption> = [
  { country: "Sweden", name: "Stockholm" },
  { country: "Sweden", name: "Gothenburg" },
  { country: "Sweden", name: "Malmö" },
  { country: "Sweden", name: "Uppsala" },
  { country: "Sweden", name: "Västerås" },
  { country: "Norway", name: "Oslo" },
  { country: "Norway", name: "Bergen" },
  { country: "Norway", name: "Trondheim" },
  { country: "Norway", name: "Stavanger" },
  { country: "Denmark", name: "Copenhagen" },
  { country: "Denmark", name: "Aarhus" },
  { country: "Denmark", name: "Odense" },
  { country: "Denmark", name: "Aalborg" },
  { country: "Finland", name: "Helsinki" },
  { country: "Finland", name: "Espoo" },
  { country: "Finland", name: "Tampere" },
  { country: "Finland", name: "Turku" }
];

type Props = {
  country: AllowedCountry;
  value: string;
  onChange: (city: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function CitySelect({ country, value, onChange, label = "City", placeholder = "Select city", disabled }: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const sheetOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetY = React.useRef(new Animated.Value(12)).current;

  const cities = React.useMemo(() => CITIES.filter((c) => c.country === country).map((c) => c.name), [country]);
  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return cities;
    return cities.filter((name) => name.toLowerCase().includes(t));
  }, [cities, q]);

  const close = () => {
    setOpen(false);
    setQ("");
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
          if (disabled) return;
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.pill, pressed && !disabled && { opacity: 0.95 }, disabled && { opacity: 0.6 }]}
        accessibilityRole="button"
      >
        <Text style={styles.pillText}>{value?.trim() ? value : placeholder}</Text>
        <Text style={styles.chev}>▼</Text>
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
              <Text style={styles.sheetTitle}>Select city</Text>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.search}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
              />

              <View style={styles.list}>
                {filtered.map((name) => {
                  const on = name === value;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => {
                        onChange(name);
                        close();
                      }}
                      style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && { opacity: 0.96 }]}
                    >
                      <Text style={styles.itemText}>{name}</Text>
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
  pillText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  chev: { color: "rgba(255,255,255,0.65)", fontWeight: "900" },
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  sheet: {
    width: "98%",
    maxWidth: 520,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  sheetTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", textAlign: "center" },
  search: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.20)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.22)"
  },
  list: { marginTop: 10, gap: 8 },
  item: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  itemOn: { backgroundColor: "rgba(255,255,255,0.12)" },
  itemText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }
});

