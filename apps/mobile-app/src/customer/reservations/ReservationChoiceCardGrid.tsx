import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
  isDark: boolean;
  t: ThemeColors;
  selectedId: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const { isDark, t } = props;
  const baseBg = isDark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.94)";
  const idleBorder = isDark ? "rgba(148,163,184,0.26)" : "rgba(226,232,240,0.94)";

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
                { borderColor: selected ? t.ordersNavPurpleBright : idleBorder }
              ]}
            >
              {selected ? (
                <LinearGradient
                  colors={
                    isDark
                      ? ["rgba(167,139,250,0.26)", "rgba(124,58,237,0.06)", "transparent"]
                      : ["rgba(167,139,250,0.14)", "rgba(255,255,255,0.55)", "transparent"]
                  }
                  locations={[0, 0.42, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              ) : null}

              <View pointerEvents="none" style={[styles.face, { backgroundColor: baseBg }]}>
                <View style={[styles.accentCap, { backgroundColor: t.ordersNavPurpleBright, opacity: selected ? 1 : 0.34 }]} />
                <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={2}>
                  {opt.label}
                </Text>
                {opt.sublabel ? (
                  <Text
                    style={[styles.cardSub, { color: selected ? t.ordersNavPurpleBright : t.textSecondary }]}
                    numberOfLines={2}
                  >
                    {opt.sublabel}
                  </Text>
                ) : null}
              </View>
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
  cellOuterSelected: {},
  cellOuterPressed: {
    transform: [{ scale: 0.987 }],
    opacity: 0.96
  },
  cellClip: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
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
      shadowOpacity: 0.22,
      shadowRadius: 22
    },
    android: { elevation: 8 },
    default: {}
  }),
  face: {
    minHeight: 100,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 14
  },
  accentCap: {
    width: "100%",
    height: 4,
    borderRadius: 3,
    marginBottom: 2
  },
  cardTitle: {
    marginTop: 4,
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
