import type { HTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Message({
  className = "",
  align = "start",
  ...props
}: HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  return <div className={cx("ui-message", align === "end" && "is-end", className)} {...props} />;
}

export function MessageAvatar({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-message-avatar", className)} {...props} />;
}

export function MessageContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-message-content", className)} {...props} />;
}

export function MessageFooter({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("ui-message-footer", className)} {...props} />;
}
