import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "../../theme/AppThemeContext";

export type ChoiceCardOpt = {
  id: string;
  label: string;
  sublabel?: string;
};

function cardHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function ReservationChoiceCardGrid(props: {
  options: readonly ChoiceCardOpt[];
  t: ThemeColors;
  selectedId: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const { t } = props;
  const idleBg = "rgba(255,255,255,0.94)";
  const idleBorder = "rgba(226,232,240,0.94)";
  const purple = t.ordersNavPurpleBright;

  return (
    <View style={styles.grid} collapsable={false}>
      {props.options.map((opt: ChoiceCardOpt) => {
        const selected = props.selectedId(opt.id);
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected }}
            onPress={() => {
              cardHaptic();
              props.onToggle(opt.id);
            }}
            style={({ pressed }) => [styles.cellOuter, pressed && styles.cellOuterPressed]}
          >
            <View
              style={[
                styles.cellClip,
                selected && styles.cellClipSelected,
                {
                  borderColor: selected ? purple : idleBorder,
                  backgroundColor: selected ? purple : idleBg
                }
              ]}
            >
              {selected && Platform.OS !== "web" ? (
                <View style={styles.selectedWhiteRing} pointerEvents="none" />
              ) : null}
              <Text
                style={[styles.cardTitle, { color: selected ? "#FFFFFF" : t.text }]}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
              {opt.sublabel ? (
                <Text
                  style={[
                    styles.cardSub,
                    { color: selected ? "rgba(255,255,255,0.88)" : t.textSecondary }
                  ]}
                  numberOfLines={2}
                >
                  {opt.sublabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    columnGap: 12,
    marginBottom: 20
  },
  cellOuter: {
    width: "48%",
    borderRadius: 20
  },
  cellOuterPressed: {
    transform: [{ scale: 0.987 }],
    opacity: 0.96
  },
  cellClip: {
    borderRadius: 20,
    borderWidth: 2,
    minHeight: 100,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#1e1b4b",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.11,
        shadowRadius: 18
      },
      android: { elevation: 5 },
      default: {}
    })
  },
  cellClipSelected: Platform.select({
    ios: {
      shadowColor: "#7C3AED",
      shadowOpacity: 0.28,
      shadowRadius: 22
    },
    android: { elevation: 8 },
    default: {}
  }),
  /** Thin inner highlight on selected experience cards (mobile). */
  selectedWhiteRing: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)"
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.28,
    lineHeight: 19
  },
  cardSub: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.12,
    lineHeight: 15
  }
});
