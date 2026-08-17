import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function InputGroup({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-input-group", className)} {...props} />;
}

export function InputGroupAddon({
  className = "",
  align,
  ...props
}: HTMLAttributes<HTMLDivElement> & { align?: "block-end" | "inline-end" }) {
  return <div className={cx("ui-input-group-addon", align === "block-end" && "is-block-end", className)} {...props} />;
}

export function InputGroupButton({
  className = "",
  size,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "icon-sm"; variant?: "default" | "outline" }) {
  return (
    <button
      className={cx("ui-input-group-btn", size === "icon-sm" && "is-icon", variant === "outline" && "is-outline", className)}
      {...props}
    />
  );
}
