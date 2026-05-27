import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

type Props = { size?: number; color: string };

/** Simple camera glyph for the chat composer. */
export function ChatIconCamera({ size = 22, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityIgnoresInvertColors>
      <Path
        d="M9.5 4.5h5l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2l1.5-2z"
        fill="none"
        stroke={color}
        strokeWidth={1.85}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.25} fill="none" stroke={color} strokeWidth={1.85} />
    </Svg>
  );
}
