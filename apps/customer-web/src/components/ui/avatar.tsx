import type { HTMLAttributes, ImgHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Avatar({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-avatar", className)} {...props} />;
}

export function AvatarImage({ className = "", alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img className={cx("ui-avatar-image", className)} alt={alt} {...props} />;
}

export function AvatarFallback({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-avatar-fallback", className)} {...props} />;
}
