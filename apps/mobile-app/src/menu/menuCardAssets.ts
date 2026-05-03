import type { ImageSourcePropType } from "react-native";

export const MENU_CARD_IMAGES: ImageSourcePropType[] = [
  require("../menuImgs/menu1.jpeg"),
  require("../menuImgs/menu2.jpeg"),
  require("../menuImgs/menu3.jpeg"),
  require("../menuImgs/menu4.jpeg")
];

/** Stable, repetitive mapping from any menu row id → one of four stock photos */
export function menuImageSourceForKey(key: string): ImageSourcePropType {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = (h * 33) ^ key.charCodeAt(i);
  }
  return MENU_CARD_IMAGES[Math.abs(h) % MENU_CARD_IMAGES.length]!;
}
