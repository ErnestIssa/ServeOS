import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ChatTokens } from "../../chatTheme";

type Props = {
  mine: boolean;
  fill: string;
  stroke: string;
};

const TAIL_W = 7;
const TAIL_H = 12;

/**
 * Sharp tail on the lower author-side bottom corner — overlaps the bubble edge so the
 * stroke reads as one continuous outline. Mine: bottom-right. Theirs: bottom-left.
 */
export function BubbleTail({ mine, fill, stroke }: Props) {
  const d = mine
    ? `M0 2 L0 ${TAIL_H - 1} L${TAIL_W} ${TAIL_H * 0.55} Z`
    : `M${TAIL_W} 2 L${TAIL_W} ${TAIL_H - 1} L0 ${TAIL_H * 0.55} Z`;

  return (
    <View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapTheirs]} pointerEvents="none">
      <Svg width={TAIL_W} height={TAIL_H} viewBox={`0 0 ${TAIL_W} ${TAIL_H}`}>
        <Path d={d} fill={fill} stroke={stroke} strokeWidth={1} strokeLinejoin="miter" strokeLinecap="butt" />
      </Svg>
    </View>
  );
}

export function bubbleShadow(tokens: ChatTokens): ViewStyle {
  return {
    shadowColor: tokens.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.85,
    shadowRadius: 5,
    elevation: 2
  };
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 2,
    zIndex: 1
  },
  wrapMine: {
    right: -TAIL_W + 1.5
  },
  wrapTheirs: {
    left: -TAIL_W + 1.5
  }
});
