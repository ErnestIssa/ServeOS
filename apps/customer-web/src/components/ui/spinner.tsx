import type { SVGProps } from "react";

type SpinnerProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

/** Compact indeterminate spinner (shadcn-style). Prefer size-* classes: size-3 … size-8. */
export function Spinner({ className = "size-6", ...props }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      fill="none"
      className={`admin-spinner ${className}`.trim()}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeOpacity="0.22"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
