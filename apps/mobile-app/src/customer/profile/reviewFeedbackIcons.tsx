import React from "react";
import Svg, { Path } from "react-native-svg";

/** Paper-plane send — matches Review mood UI (stroke/fill via `color`). */
export function ReviewFeedbackSubmitIcon({
  size = 24,
  color = "#FFFFFF"
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.4 11.2L20.2 3.1C20.7 2.9 21.2 3.4 21 3.9L12.9 20.7C12.7 21.1 12.2 21.2 11.9 20.9L9.2 17.8L5.1 19.1L6.4 15L3.3 12.3C3 12 3.1 11.5 3.4 11.2Z"
        fill={color}
        stroke={color}
        strokeWidth={0.35}
        strokeLinejoin="round"
      />
      <Path
        d="M9.2 17.8L12.1 12.4"
        stroke={color}
        strokeWidth={1.35}
        strokeLinecap="round"
      />
    </Svg>
  );
}
