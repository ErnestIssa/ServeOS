import { LoaderIcon } from "lucide-react";
import type { ComponentProps } from "react";

function Spinner({ className, ...props }: ComponentProps<typeof LoaderIcon>) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={["admin-comms-loader-icon", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function CommsColumnLoader({ className }: { className?: string }) {
  return (
    <div className={["admin-comms-pane-loading", className].filter(Boolean).join(" ")}>
      <Spinner className="size-5" />
    </div>
  );
}
