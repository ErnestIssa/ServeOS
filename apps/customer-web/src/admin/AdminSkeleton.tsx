import type { CSSProperties, ReactNode } from "react";

type BoneProps = {
  className?: string;
  style?: CSSProperties;
  rounded?: "sm" | "md" | "lg" | "full";
};

export function SkeletonBone({ className = "", style, rounded = "md" }: BoneProps) {
  const radius =
    rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-xl" : rounded === "sm" ? "rounded-md" : "rounded-lg";
  return <span className={`admin-skeleton ${radius} ${className}`} style={style} aria-hidden />;
}

export function AdminSkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy aria-label="Loading statistics">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="admin-stat-card rounded-xl border p-4 shadow-sm">
          <SkeletonBone className="h-2.5 w-20" rounded="sm" />
          <SkeletonBone className="mt-3 h-8 w-16" />
          <SkeletonBone className="mt-2 h-3 w-28" rounded="sm" />
        </div>
      ))}
    </div>
  );
}

export function AdminSkeletonTable({
  rows = 6,
  columns = 6
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="admin-orders-table-scroll" aria-busy aria-label="Loading table">
      <table className="admin-orders-table w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="px-3 py-3">
                <SkeletonBone className="h-3 w-16" rounded="sm" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, col) => (
                <td key={col} className="px-3 py-3">
                  <SkeletonBone className={`h-4 ${col === 0 ? "w-20" : col === columns - 1 ? "w-24" : "w-full max-w-[8rem]"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSkeletonKanban({ perColumn = 3 }: { perColumn?: number }) {
  const cols = ["new", "preparing", "ready"] as const;
  return (
    <div className="admin-orders-kds" aria-busy aria-label="Loading kitchen board">
      {cols.map((col) => (
        <div key={col} className={`admin-orders-kds-col admin-orders-kds-col--${col}`}>
          <header className="admin-orders-kds-col-header">
            <SkeletonBone className="h-4 w-20" />
            <SkeletonBone className="h-5 w-6 rounded-full" />
          </header>
          <ul className="admin-orders-kds-list">
            {Array.from({ length: perColumn }, (_, i) => (
              <li key={i} className="admin-orders-kds-card rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <SkeletonBone className="h-4 w-14" />
                  <SkeletonBone className="h-5 w-12 rounded-full" />
                </div>
                <SkeletonBone className="mt-3 h-3 w-full" />
                <SkeletonBone className="mt-2 h-3 w-2/3" />
                <div className="mt-3 flex gap-2">
                  <SkeletonBone className="h-7 w-16 rounded-full" />
                  <SkeletonBone className="h-7 w-14 rounded-full" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminSkeletonProfile() {
  return (
    <div className="mt-8 space-y-5" aria-busy aria-label="Loading profile">
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="admin-top-page-card rounded-xl border p-5 xl:col-span-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <SkeletonBone className="h-20 w-20 shrink-0" rounded="full" />
            <div className="w-full space-y-2">
              <SkeletonBone className="mx-auto h-6 w-40 sm:mx-0" />
              <SkeletonBone className="mx-auto h-4 w-52 sm:mx-0" />
              <SkeletonBone className="mx-auto h-6 w-24 sm:mx-0 rounded-full" />
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2 sm:justify-start">
            <SkeletonBone className="h-9 w-28 rounded-full" />
            <SkeletonBone className="h-9 w-28 rounded-full" />
          </div>
        </div>
        <div className="admin-top-page-card rounded-xl border p-5 xl:col-span-8">
          <SkeletonBone className="h-4 w-32" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <SkeletonBone className="mb-2 h-3 w-20" rounded="sm" />
                <SkeletonBone className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="admin-top-page-card rounded-xl border p-5">
            <SkeletonBone className="h-4 w-36" />
            <SkeletonBone className="mt-4 h-3 w-full" />
            <SkeletonBone className="mt-2 h-3 w-4/5" />
            <div className="mt-5 flex gap-2">
              <SkeletonBone className="h-9 w-32 rounded-full" />
              <SkeletonBone className="h-9 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSkeletonStaffTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-staff-table-wrap overflow-hidden rounded-xl border" aria-busy aria-label="Loading staff">
      <div className="border-b px-4 py-3">
        <SkeletonBone className="h-3 w-28" rounded="sm" />
      </div>
      <ul>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
            <SkeletonBone className="h-10 w-10 shrink-0" rounded="full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBone className="h-4 w-36" />
              <SkeletonBone className="h-3 w-48" rounded="sm" />
            </div>
            <SkeletonBone className="h-6 w-20 rounded-full" />
            <SkeletonBone className="hidden h-8 w-24 rounded-full sm:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminSkeletonMenuPreview() {
  return (
    <div className="mt-4 max-h-80 space-y-5 overflow-hidden" aria-busy aria-label="Loading menu">
      {Array.from({ length: 3 }, (_, cat) => (
        <div key={cat}>
          <SkeletonBone className="h-5 w-32" />
          <ul className="mt-3 space-y-3 pl-1">
            {Array.from({ length: 3 }, (_, item) => (
              <li key={item} className="border-l-2 border-slate-200/80 pl-3">
                <SkeletonBone className="h-4 w-48" />
                <SkeletonBone className="mt-2 h-3 w-32" rounded="sm" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminSkeletonFormRows({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="mt-3 space-y-3" aria-busy aria-label="Loading form">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid gap-3 sm:grid-cols-2">
          <SkeletonBone className="h-10 w-full rounded-xl" />
          <SkeletonBone className="h-10 w-full rounded-xl" />
        </li>
      ))}
    </ul>
  );
}

export function AdminSkeletonQuote() {
  return (
    <div className="mt-4 space-y-4" aria-busy aria-label="Loading quote">
      <SkeletonBone className="h-6 w-48" />
      <SkeletonBone className="h-4 w-full" />
      <SkeletonBone className="h-4 w-5/6" />
      <div className="rounded-xl border p-4 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between gap-3">
            <SkeletonBone className="h-4 w-40" />
            <SkeletonBone className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSkeletonDeploymentPlans() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy aria-label="Loading plans">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-2xl border p-5">
          <SkeletonBone className="h-5 w-28" />
          <SkeletonBone className="mt-3 h-8 w-20" />
          <SkeletonBone className="mt-4 h-3 w-full" />
          <SkeletonBone className="mt-2 h-3 w-4/5" />
          <SkeletonBone className="mt-5 h-10 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Keeps children visible while refreshing; dims slightly and shows a top progress bar. */
export function AdminStaleContent({
  refreshing,
  children,
  className = ""
}: {
  refreshing?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-stale-content${refreshing ? " admin-stale-content--refreshing" : ""} ${className}`.trim()}>
      {refreshing ? <span className="admin-stale-content__bar" aria-hidden /> : null}
      {children}
    </div>
  );
}
