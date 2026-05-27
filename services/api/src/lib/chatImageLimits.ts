/** Customer chat image policy (server-enforced). */
export const CHAT_MAX_IMAGES_PER_SEND = 3;
export const CHAT_MAX_IMAGES_PER_ROOM = 10;
export const CHAT_IMAGE_MAX_BASE64_CHARS = 520_000;
export const CHAT_ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ChatImageMime = (typeof CHAT_ALLOWED_IMAGE_MIMES)[number];

export function buildImageDataUri(mime: ChatImageMime, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

export function parseImageDataUri(content: string): { mime: ChatImageMime; base64: string } | null {
  const m = content.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const mime = m[1] as ChatImageMime;
  if (!CHAT_ALLOWED_IMAGE_MIMES.includes(mime)) return null;
  return { mime, base64: m[2] };
}
