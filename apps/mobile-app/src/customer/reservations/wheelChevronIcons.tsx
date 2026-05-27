import React from "react";
import Svg, { Path } from "react-native-svg";

const CHEVRON_STROKE = 0.85;

/** From `assets/up-chevron-svgrepo-com.svg` */
export function WheelChevronUp({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 7C12.2652 7 12.5196 7.10536 12.7071 7.29289L19.7071 14.2929C20.0976 14.6834 20.0976 15.3166 19.7071 15.7071C19.3166 16.0976 18.6834 16.0976 18.2929 15.7071L12 9.41421L5.70711 15.7071C5.31658 16.0976 4.68342 16.0976 4.29289 15.7071C3.90237 15.3166 3.90237 14.6834 4.29289 14.2929L11.2929 7.29289C11.4804 7.10536 11.7348 7 12 7Z"
        fill={color}
        stroke={color}
        strokeWidth={CHEVRON_STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** From `assets/down-chevron-svgrepo-com.svg` (normalized to 24×24 for weight match with up) */
export function WheelChevronDown({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 16.5c-0.2652 0-0.5196-0.105-0.7071-0.293L4.293 9.207a1 1 0 0 1 1.414-1.414L12 14.086l6.293-6.293a1 1 0 1 1 1.414 1.414l-7 7A1 1 0 0 1 12 16.5Z"
        fill={color}
        stroke={color}
        strokeWidth={CHEVRON_STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
