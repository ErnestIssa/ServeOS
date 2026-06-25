import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";

const ROTATE_MS = 3000;

const VENUE_TYPES = [
  { label: "restaurant", color: "#7C3AED", fontWeight: "900" as const, fontStyle: "normal" as const },
  { label: "bar", color: "#047857", fontWeight: "800" as const, fontStyle: "italic" as const },
  { label: "café", color: "#B45309", fontWeight: "700" as const, fontStyle: "normal" as const },
  { label: "bistro", color: "#BE185D", fontWeight: "900" as const, fontStyle: "italic" as const },
  { label: "pub", color: "#1D4ED8", fontWeight: "800" as const, fontStyle: "normal" as const },
  { label: "lounge", color: "#0F766E", fontWeight: "900" as const, fontStyle: "normal" as const, letterSpacing: 0.6 }
] as const;

export function ChatVenueTypeRotator() {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % VENUE_TYPES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const current = VENUE_TYPES[index]!;

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>
        Want to contact a{" "}
        <Text
          style={[
            styles.venueType,
            {
              color: current.color,
              fontWeight: current.fontWeight,
              fontStyle: current.fontStyle,
              letterSpacing: "letterSpacing" in current ? current.letterSpacing : 0
            }
          ]}
        >
          {current.label}
        </Text>
        ?
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, alignItems: "center" },
  prompt: {
    textAlign: "center",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    color: R.text
  },
  venueType: {
    fontSize: 22,
    lineHeight: 28
  }
});
