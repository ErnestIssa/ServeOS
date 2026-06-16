export function AdminNavChevron({ open, className = "" }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${className}`.trim()}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
