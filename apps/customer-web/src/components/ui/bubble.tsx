import type { HTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Bubble({
  className = "",
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "muted" }) {
  return <div className={cx("ui-bubble", variant === "muted" && "is-muted", className)} {...props} />;
}

export function BubbleContent({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("ui-bubble-content", className)} {...props} />;
}

export function BubbleGroup({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-bubble-group", className)} {...props} />;
}

export function BubbleReactions({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-bubble-reactions", className)} {...props} />;
}
