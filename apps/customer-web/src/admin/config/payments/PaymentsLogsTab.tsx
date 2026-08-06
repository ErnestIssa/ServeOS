import { useMemo, useState } from "react";
import type { PaymentLogRow } from "../../../api";
import { MenuListSearchField } from "../menu/MenuPageUi";
import { PayChip } from "./paymentsShared";
import { formatWhen } from "./paymentsUiHelpers";

type Props = {
  logs: PaymentLogRow[];
  source?: "live" | "demo";
};

const CATEGORIES = ["all", "webhook", "payment", "refund", "security", "config", "reconciliation"] as const;

export function PaymentsLogsTab({ logs, source }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (category !== "all" && l.category !== category) return false;
      if (!q) return true;
      return l.message.toLowerCase().includes(q) || l.category.includes(q) || l.level.includes(q);
    });
  }, [logs, search, category]);

  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-list-toolbar">
        <MenuListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search payment logs…"
          aria-label="Search payment logs"
        />
        <div className="admin-payments-filter-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`admin-payments-filter-chip${category === c ? " is-active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      {source === "demo" ? (
        <p className="admin-config-text-subtle text-xs">Operational logs from the payment API (includes demo + config audit).</p>
      ) : null}

      <div className="admin-payments-surface-list">
        {filtered.length === 0 ? (
          <p className="admin-config-text-muted text-sm p-2">No logs.</p>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className="admin-payments-surface-row is-static">
              <div className="min-w-0">
                <p className="font-semibold admin-config-text">{log.message}</p>
                <p className="admin-config-text-subtle text-xs mt-0.5">
                  {log.category} · {formatWhen(log.at)}
                </p>
              </div>
              <PayChip tone={log.level === "error" ? "danger" : log.level === "warn" ? "warning" : "muted"}>
                {log.level}
              </PayChip>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
