/**
 * Glyph from `apps/mobile-app/assets/shopping-cart-svgrepo-com.svg` (icon carrier path, viewBox 0 0 30 30).
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

const CART_D =
  "M 4.9882812 5 L 4.9882812 7 L 6.4042969 7 L 10.429688 14.904297 L 9.0996094 17.664062 C 8.6262975 18.646723 9.8975785 20 10.988281 20 L 22.988281 20 L 22.988281 18 L 10.988281 18 L 11.927734 16 L 20.488281 16 C 21.042281 16 21.234967 15.4927 21.488281 15 L 24.955078 8.2578125 C 25.208392 7.7651225 24.542281 7 23.988281 7 L 8.6503906 7 L 7.6328125 5 L 5.9882812 5 L 5.3867188 5 L 4.9882812 5 z M 10.988281 21 A 2 2 0 0 0 8.9882812 23 A 2 2 0 0 0 10.988281 25 A 2 2 0 0 0 12.988281 23 A 2 2 0 0 0 10.988281 21 z M 20.988281 21 A 2 2 0 0 0 18.988281 23 A 2 2 0 0 0 20.988281 25 A 2 2 0 0 0 22.988281 23 A 2 2 0 0 0 20.988281 21 z";

type Props = { size?: number; color?: string };

export function ShoppingCartGlyph({ size = 28, color = "#1e293b" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30" accessibilityIgnoresInvertColors>
      <Path d={CART_D} fill={color} />
    </Svg>
  );
}
