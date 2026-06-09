import { useEffect, useId, useMemo, useRef, useState } from "react";
import { readOwnerContactName } from "./adminNavContent";

type Venue = { id: string; name: string; status?: string };

type TypingPhase = "typing" | "hold" | "deleting" | "pause";

type VenueStatusTone = "active" | "inactive" | "pending" | "deleted";

function venueStatusDisplay(
  membershipStatus: string | undefined,
  isSelected: boolean
): { label: string; tone: VenueStatusTone } {
  const status = (membershipStatus ?? "ACTIVE").toUpperCase();
  if (status === "PENDING_APPROVAL") return { label: "Pending", tone: "pending" };
  if (status === "REJECTED" || status === "SUSPENDED") return { label: "Deleted", tone: "deleted" };
  if (status === "ACTIVE") {
    return isSelected ? { label: "Active", tone: "active" } : { label: "Not Active", tone: "inactive" };
  }
  return { label: "Not Active", tone: "inactive" };
}

function NavChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`ml-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function buildAdminSearchPlaceholders(ownerName: string, restaurantName: string): string[] {
  const first = ownerName.split(/\s+/)[0] || ownerName;
  const venue = restaurantName || "your venue";
  return [
    `Search live orders at ${venue}…`,
    `Find tables and covers for ${venue}…`,
    `Look up guests visiting ${venue}…`,
    `${first}, search menu items at ${venue}…`,
    `Track kitchen queue for ${venue}…`,
    `Find reservations at ${venue}…`,
    `${first}, pull up today's sales at ${venue}…`,
    `Search staff shifts for ${venue}…`
  ];
}

export function AdminTypingSearch({
  ownerSignupProfile,
  restaurantName
}: {
  ownerSignupProfile?: unknown;
  restaurantName: string;
}) {
  const ownerName = readOwnerContactName(ownerSignupProfile);
  const phrases = useMemo(
    () => buildAdminSearchPlaceholders(ownerName, restaurantName),
    [ownerName, restaurantName]
  );

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<TypingPhase>("typing");
  const inputId = useId();

  useEffect(() => {
    if (focused || value) return;
    const phrase = phrases[phraseIndex % phrases.length] ?? "";
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing" && typed.length < phrase.length) {
      timer = setTimeout(() => setTyped(phrase.slice(0, typed.length + 1)), 78);
    } else if (phase === "typing" && typed.length === phrase.length) {
      setPhase("hold");
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("deleting"), 3400);
    } else if (phase === "deleting" && typed.length > 0) {
      timer = setTimeout(() => setTyped(phrase.slice(0, typed.length - 1)), 34);
    } else if (phase === "deleting" && typed.length === 0) {
      setPhase("pause");
    } else if (phase === "pause") {
      timer = setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % phrases.length);
        setPhase("typing");
      }, 1100);
    }

    return () => clearTimeout(timer);
  }, [focused, value, phrases, phraseIndex, typed, phase]);

  useEffect(() => {
    setTyped("");
    setPhase("typing");
    setPhraseIndex(0);
  }, [phrases]);

  const showGhost = !focused && !value;

  return (
    <label className="admin-global-search group relative block w-full" htmlFor={inputId}>
      <span className="sr-only">Global search</span>
      <img
        src="/icons/magnifying-glass.png"
        alt=""
        className="admin-search-icon pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2"
        aria-hidden
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder=""
        className="admin-search-input relative z-[2] w-full rounded-2xl py-2 pl-10 pr-4 text-sm outline-none transition"
        autoComplete="off"
      />
      {showGhost ? (
        <span className="admin-search-ghost pointer-events-none absolute inset-y-0 left-10 right-4 z-[3] flex items-center truncate text-sm">
          <span className="truncate">{typed}</span>
          <span className="admin-search-cursor" aria-hidden />
        </span>
      ) : null}
    </label>
  );
}

export function AdminRestaurantSelector({
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
  switching
}: {
  restaurants: Venue[];
  selectedRestaurantId: string;
  onSelectRestaurant: (id: string) => void;
  switching?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = restaurants.find((r) => r.id === selectedRestaurantId);
  const hasSelection = Boolean(selected);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="admin-venue-switcher relative hidden min-w-0 sm:block">
      <button
        type="button"
        disabled={switching}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="admin-venue-switcher-trigger"
      >
        <span className="admin-venue-switcher-icon" aria-hidden>
          <img src="/icons/store.png" alt="" className="admin-venue-switcher-store-icon" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span
            className={`admin-venue-switcher-name truncate ${hasSelection ? "admin-venue-switcher-name--active" : ""}`}
          >
            {switching ? "Switching venue…" : selected?.name ?? (restaurants.length === 0 ? "No venues" : "Select venue…")}
          </span>
        </span>
        <NavChevron open={open} />
      </button>

      {open ? (
        <div className="admin-top-bubble-anchor admin-top-bubble-anchor--center admin-venue-bubble-anchor">
          <div className="admin-top-bubble admin-top-bubble--arrow-center admin-venue-bubble" role="menu" aria-label="Restaurant locations">
            <div className="admin-bubble-header">
              <p className="admin-bubble-title">Your venues</p>
              <p className="admin-bubble-desc">Switch the active location for this workspace.</p>
            </div>
            <div className="admin-bubble-body admin-bubble-body--menu">
              {restaurants.length === 0 ? (
                <p className="px-2.5 pb-1 text-[11px] leading-relaxed text-[var(--admin-text-muted)]">No venues yet.</p>
              ) : (
                restaurants.map((r) => {
                  const isSelected = r.id === selectedRestaurantId;
                  const venueStatus = venueStatusDisplay(r.status, isSelected);
                  const canSelect = (r.status ?? "ACTIVE").toUpperCase() === "ACTIVE";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="menuitem"
                      disabled={!canSelect}
                      className={`admin-venue-menu-item ${isSelected ? "admin-venue-menu-item--selected" : ""}`}
                      onClick={() => {
                        setOpen(false);
                        if (canSelect && !isSelected) onSelectRestaurant(r.id);
                      }}
                    >
                      <span className="admin-venue-menu-name truncate">{r.name}</span>
                      <span className={`admin-venue-status admin-venue-status--${venueStatus.tone}`}>
                        {venueStatus.label}
                      </span>
                    </button>
                  );
                })
              )}
              <div className="admin-bubble-divider" />
              <a href="#config-restaurant" className="admin-bubble-add-btn" onClick={() => setOpen(false)}>
                <span className="admin-bubble-add-mark">+</span>
                <span className="admin-bubble-add-mark">Add</span>
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
