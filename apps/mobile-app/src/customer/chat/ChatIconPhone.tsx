import React from "react";
import { Image } from "react-native";

const TELEPHONE_ICON = require("../../../assets/telephone.png");

type Props = { size?: number; color: string };

/** Phone handset glyph for calling the venue. */
export function ChatIconPhone({ size = 18, color }: Props) {
  return (
    <Image
      source={TELEPHONE_ICON}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
