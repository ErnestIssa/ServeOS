import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
import { SkeletonPulse } from "./SkeletonUi";

const BONE = "rgba(255,255,255,0.16)";
const BONE_SOFT = "rgba(255,255,255,0.1)";

type Props = {
  hint: string;
  sub?: string | null;
};

/** Full-screen session connect placeholder — skeleton instead of spinner. */
export function AppConnectSkeleton({ hint, sub }: Props) {
  return (
    <View style={styles.full}>
      <Text style={styles.hint}>{hint}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      <View style={styles.body}>
        <SkeletonPulse style={styles.pulse}>
          <View style={styles.greetingBone} />
          <View style={styles.subBone} />
          <View style={styles.ctaBone} />
          <View style={styles.sectionLabel} />
          <View style={styles.cardRow}>
            <View style={[styles.cardBone, { backgroundColor: BONE }]} />
            <View style={[styles.cardBone, { backgroundColor: BONE_SOFT }]} />
          </View>
          <View style={styles.listRow}>
            <View style={[styles.avatarBone, { backgroundColor: BONE }]} />
            <View style={styles.listText}>
              <View style={[styles.lineBone, { width: "58%", backgroundColor: BONE }]} />
              <View style={[styles.lineBone, { width: "42%", backgroundColor: BONE_SOFT }]} />
            </View>
          </View>
          <View style={styles.listRow}>
            <View style={[styles.avatarBone, { backgroundColor: BONE_SOFT }]} />
            <View style={styles.listText}>
              <View style={[styles.lineBone, { width: "52%", backgroundColor: BONE }]} />
              <View style={[styles.lineBone, { width: "36%", backgroundColor: BONE_SOFT }]} />
            </View>
          </View>
        </SkeletonPulse>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(139,92,246,0)", "rgba(139,92,246,0.55)", "rgba(139,92,246,0.98)"]}
          locations={[0, 0.5, 1]}
          style={styles.fadeTail}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: R.accentPurple
  },
  hint: { color: "rgba(255,255,255,0.94)", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  sub: {
    marginTop: 8,
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  body: {
    marginTop: 28,
    width: "100%",
    maxWidth: 360,
    minHeight: 320,
    overflow: "hidden",
    position: "relative"
  },
  pulse: { gap: 14, paddingBottom: 48 },
  greetingBone: {
    alignSelf: "center",
    width: "62%",
    height: 22,
    borderRadius: 11,
    backgroundColor: BONE
  },
  subBone: {
    alignSelf: "center",
    width: "78%",
    height: 14,
    borderRadius: 7,
    backgroundColor: BONE_SOFT
  },
  ctaBone: {
    alignSelf: "center",
    width: "48%",
    height: 44,
    borderRadius: 22,
    marginTop: 6,
    backgroundColor: BONE
  },
  sectionLabel: {
    width: "28%",
    height: 12,
    borderRadius: 6,
    marginTop: 8,
    backgroundColor: BONE_SOFT
  },
  cardRow: { flexDirection: "row", gap: 10 },
  cardBone: { flex: 1, height: 118, borderRadius: 16 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  avatarBone: { width: 44, height: 44, borderRadius: 14 },
  listText: { flex: 1, gap: 8 },
  lineBone: { height: 12, borderRadius: 6 },
  fadeTail: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120
  }
});
