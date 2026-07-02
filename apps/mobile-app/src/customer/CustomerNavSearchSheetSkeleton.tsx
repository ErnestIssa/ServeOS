import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SkeletonBone, SkeletonPulse } from "../components/skeleton/SkeletonUi";
import { R } from "../theme";

const DOCK_SOFT = "rgba(255,255,255,0.08)";
const DOCK_STRONG = "rgba(255,255,255,0.14)";

export function CustomerNavSearchSheetSkeleton() {
  return (
    <SkeletonPulse style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBone tone={DOCK_STRONG} style={styles.sectionLabel} />
        <View style={styles.chipRow}>
          <SkeletonBone tone={DOCK_STRONG} style={styles.chip} />
          <SkeletonBone tone={DOCK_SOFT} style={styles.chipWide} />
          <SkeletonBone tone={DOCK_SOFT} style={styles.chip} />
        </View>

        <SkeletonBone tone={DOCK_STRONG} style={[styles.sectionLabel, styles.sectionGap]} />
        <View style={styles.chipRow}>
          <SkeletonBone tone={DOCK_SOFT} style={styles.catPill} />
          <SkeletonBone tone={DOCK_SOFT} style={styles.catPill} />
          <SkeletonBone tone={DOCK_SOFT} style={styles.catPillShort} />
        </View>

        <View style={styles.sectionBlock}>
          <SkeletonBone tone={DOCK_STRONG} style={styles.sectionTitle} />
          <SkeletonBone tone={DOCK_SOFT} style={styles.sectionSub} />
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.resultRow}>
              <SkeletonBone tone={DOCK_SOFT} style={styles.resultImg} />
              <View style={styles.resultBody}>
                <SkeletonBone tone={DOCK_STRONG} style={styles.resultTitle} />
                <SkeletonBone tone={DOCK_SOFT} style={styles.resultSub} />
                <SkeletonBone tone={DOCK_SOFT} style={styles.resultPrice} />
              </View>
              <SkeletonBone tone={DOCK_STRONG} style={styles.addBtn} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 120 },
  content: {
    paddingTop: 4,
    paddingHorizontal: R.space.sm,
    paddingBottom: 28
  },
  sectionLabel: {
    width: 132,
    height: 14,
    borderRadius: 7,
    marginBottom: 12
  },
  sectionGap: { marginTop: 18 },
  chipRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4
  },
  chip: {
    width: 88,
    height: 38,
    borderRadius: 999
  },
  chipWide: {
    width: 112,
    height: 38,
    borderRadius: 999
  },
  catPill: {
    width: 78,
    height: 36,
    borderRadius: 999
  },
  catPillShort: {
    width: 64,
    height: 36,
    borderRadius: 999
  },
  sectionBlock: {
    marginTop: 22,
    gap: 12
  },
  sectionTitle: {
    width: "68%",
    height: 18,
    borderRadius: 8
  },
  sectionSub: {
    width: "46%",
    height: 13,
    borderRadius: 7,
    marginBottom: 4
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10
  },
  resultImg: {
    width: 58,
    height: 58,
    borderRadius: R.radius.tile
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
    gap: 8
  },
  resultTitle: {
    width: "84%",
    height: 15,
    borderRadius: 7
  },
  resultSub: {
    width: "62%",
    height: 12,
    borderRadius: 6
  },
  resultPrice: {
    width: 52,
    height: 13,
    borderRadius: 6
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 14
  }
});
