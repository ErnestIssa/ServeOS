import { useMemo, useState } from "react";
import { useAdminPopoverMount } from "../useAdminPopoverMount";

export type PickOption = { value: string; label: string; hint?: string };

type Props = {
  label: string;
  value: string;
  options: PickOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function ProfilePickDropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search…"
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { mounted, visible } = useAdminPopoverMount(open);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query, searchable]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="admin-profile-pick" onMouseLeave={close}>
      <span className="admin-profile-pick-label">{label}</span>
      <button
        type="button"
        className={`admin-profile-pick-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="admin-profile-pick-value">{selected?.label ?? value}</span>
        <span className="admin-profile-pick-chevron" aria-hidden />
      </button>

      {mounted ? (
        <div
          className={`admin-profile-pick-anchor${visible ? " is-visible" : ""}`}
          onMouseEnter={() => setOpen(true)}
        >
          <div
            className="admin-top-bubble admin-top-bubble--arrow-center admin-profile-pick-bubble"
            role="listbox"
            aria-label={label}
          >
            {searchable ? (
              <div className="admin-bubble-header admin-profile-pick-search-header">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="admin-profile-pick-search"
                  autoComplete="off"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <div className="admin-bubble-header">
                <p className="admin-bubble-title">{label}</p>
              </div>
            )}
            <div className="admin-bubble-body admin-bubble-body--menu admin-profile-pick-bubble-body">
              {filtered.length === 0 ? (
                <p className="admin-profile-pick-empty">No matches</p>
              ) : (
                filtered.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`admin-bubble-menu-item w-full text-left${active ? " is-selected" : ""}`}
                      onClick={() => {
                        onChange(opt.value);
                        close();
                      }}
                    >
                      <span className="admin-bubble-item-title">{opt.label}</span>
                      {opt.hint ? <span className="admin-bubble-item-desc">{opt.hint}</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
