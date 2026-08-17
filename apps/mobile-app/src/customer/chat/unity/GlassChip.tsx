import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { radius, shadows } from "./theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
};

export function GlassChip({ children, style, intensity = 85 }: Props) {
  return (
    <View style={[styles.wrap, shadows.card, style]}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)"
  },
  androidGlass: {
    backgroundColor: "rgba(255,255,255,0.92)"
  }
});
