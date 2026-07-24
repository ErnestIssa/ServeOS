import type { MediaUsageGraphNode } from "../../../api";
import { syncAdminNavHash } from "../../adminWorkspaceRouting";

const GROUP_ORDER = ["Menus", "Items", "Categories", "Venue"] as const;

type Props = {
  usages: MediaUsageGraphNode[];
  emptyLabel?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (usageId: string) => void;
};

export function MediaUsageGraph({
  usages,
  emptyLabel = "Not attached to any surface yet.",
  selectable = false,
  selectedIds,
  onToggleSelect
}: Props) {
  if (usages.length === 0) {
    return <p className="admin-staff-profile-muted text-sm">{emptyLabel}</p>;
  }

  const grouped = new Map<string, MediaUsageGraphNode[]>();
  for (const u of usages) {
    const key = u.group || "Other";
    const list = grouped.get(key) ?? [];
    list.push(u);
    grouped.set(key, list);
  }

  const keys = [
    ...GROUP_ORDER.filter((g) => grouped.has(g)),
    ...[...grouped.keys()].filter((g) => !(GROUP_ORDER as readonly string[]).includes(g))
  ];

  return (
    <div className="space-y-4">
      {keys.map((group) => (
        <div key={group}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] admin-config-text-muted">
            {group}
          </p>
          <ul className="mt-2 space-y-1.5">
            {(grouped.get(group) ?? []).map((u) => {
              const label = u.label || u.targetType;
              const href = u.hrefHint;
              return (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  {selectable ? (
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(u.id) ?? false}
                      onChange={() => onToggleSelect?.(u.id)}
                      aria-label={`Select ${label}`}
                    />
                  ) : null}
                  {href ? (
                    <button
                      type="button"
                      className="text-left font-semibold underline-offset-2 hover:underline admin-config-text"
                      onClick={() => syncAdminNavHash(href)}
                    >
                      {label}
                    </button>
                  ) : (
                    <span className="font-semibold admin-config-text">{label}</span>
                  )}
                  <span className="admin-config-text-subtle text-xs">{u.role}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
