import type { HTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Marker({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-marker", className)} role="status" {...props} />;
}

export function MarkerContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-marker-content", className)} {...props} />;
}
