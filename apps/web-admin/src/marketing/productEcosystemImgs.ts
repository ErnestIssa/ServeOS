import { imgPath } from "./assetPaths";

/** All product screenshots — `/public/imgs` only. */
export const PRODUCT_SCREENSHOT_FILES = [
  "bookComfirmImg.jpeg",
  "bookingImg.jpeg",
  "livechatRestaurant-customer-supportImg.jpeg",
  "liveOrderImg.jpeg",
  "mainMenuImg.jpeg",
  "menudisplayImg.jpeg",
  "notificationsImg.jpeg",
  "notificationsOrderImg.jpeg",
  "orderDetailsImg.jpeg",
  "reservationTimerImg.jpeg"
] as const;

export const PRODUCT_SCREENSHOT_SRCS = PRODUCT_SCREENSHOT_FILES.map((file) => imgPath(file));

export function pickRandomScreenshots(count: number, exclude: string[] = []): string[] {
  const pool = PRODUCT_SCREENSHOT_SRCS.filter((src) => !exclude.includes(src));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export const CHECKOUT_SCREENSHOT = imgPath("liveOrderImg.jpeg");
