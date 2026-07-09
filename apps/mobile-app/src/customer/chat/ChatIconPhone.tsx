import React from "react";
import Svg, { Path } from "react-native-svg";

type Props = { size?: number; color: string };

/** Phone handset glyph for calling the venue. */
export function ChatIconPhone({ size = 18, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityIgnoresInvertColors>
      <Path
        d="M8.2 4.8c.5-1.1 1.8-1.6 2.9-1.1l1.5.7c1 .5 1.4 1.7.9 2.7l-.8 1.6c-.3.6-.2 1.3.2 1.8 1.6 1.8 3.5 3.4 5.7 4.7.6.3 1.3.4 1.9.1l1.6-.8c1-.5 2.2-.1 2.7.9l.7 1.5c.5 1.1 0 2.4-1.1 2.9l-1.7.8c-1.3.6-2.8.6-4.2.1-3.2-1.3-6-3.4-8.2-6.1-2.2-2.7-3.7-5.8-4.3-9.1-.2-1.4-.1-2.9.6-4.2l.8-1.7z"
        fill={color}
      />
    </Svg>
  );
}
