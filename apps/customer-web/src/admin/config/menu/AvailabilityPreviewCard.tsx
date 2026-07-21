import { AnimatePresence, motion } from "framer-motion";
import type { AvailabilityChannel, AvailabilityScheduleKind, AvailabilityVisibility } from "../../../api";
import { MenuChip } from "./MenuPageUi";
import {
  availabilityPreviewCardStyle,
  formatAvailabilityChannels,
  formatAvailabilityDays,
  resolveAvailabilityColor
} from "./availabilityHelpers";

const PREVIEW_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const }
};

type Props = {
  label: string;
  start: string;
  end: string;
  days: number[];
  menuName: string;
  enabled: boolean;
  color: string;
  scheduleKind?: AvailabilityScheduleKind;
  channels?: AvailabilityChannel[];
  visibility?: AvailabilityVisibility;
  outOfStock?: boolean;
  locationMode?: "ALL" | "SELECTED";
};

function PreviewLine({ value, className }: { value: string; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p key={value} className={className} {...PREVIEW_MOTION}>
        {value}
      </motion.p>
    </AnimatePresence>
  );
}

export function AvailabilityPreviewCard({
  label,
  start,
  end,
  days,
  menuName,
  enabled,
  color,
  scheduleKind = "RECURRING",
  channels,
  visibility = "CUSTOMERS",
  outOfStock = false,
  locationMode = "ALL"
}: Props) {
  const resolvedColor = resolveAvailabilityColor(color);
  const style = availabilityPreviewCardStyle(resolvedColor);
  const displayLabel = label.trim() || "Window name";
  const hours = `${start || "09:00"} – ${end || "17:00"}`;
  const daysLabel = formatAvailabilityDays(days);
  const menuLabel = `Menu: ${menuName || "Menu"}`;
  const kindLabel =
    scheduleKind === "SEASONAL" ? "Seasonal" : scheduleKind === "TEMPORARY" ? "Temporary" : "Recurring";
  const channelLabel = formatAvailabilityChannels(channels);
  const locationLabel = locationMode === "SELECTED" ? "Selected locations" : "All locations";
  const visibilityLabel =
    visibility === "HIDDEN"
      ? "Hidden"
      : visibility === "STAFF_ONLY"
        ? "Staff only"
        : visibility === "TESTING"
          ? "Testing"
          : "Customers";
  const statusLabel = !enabled ? "Unavailable" : outOfStock ? "Out of Stock" : "Available";

  return (
    <div className="admin-menu-availability-preview">
      <p className="admin-menu-availability-preview__label">Card preview</p>
      <div className="admin-menu-availability-card admin-menu-availability-card--preview" style={style}>
        <PreviewLine value={displayLabel} className="admin-menu-availability-card__title truncate" />
        <PreviewLine value={`${kindLabel} · ${hours}`} className="admin-menu-availability-card__line mt-1 text-xs" />
        <PreviewLine value={daysLabel} className="admin-menu-availability-card__line text-xs" />
        <PreviewLine value={channelLabel} className="admin-menu-availability-card__line text-xs" />
        <PreviewLine value={`${locationLabel} · ${visibilityLabel}`} className="admin-menu-availability-card__line text-xs opacity-90" />
        <PreviewLine value={menuLabel} className="admin-menu-availability-card__line text-xs opacity-90" />
        <div className="admin-menu-availability-card__footer">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={statusLabel} {...PREVIEW_MOTION}>
              <MenuChip tone={enabled && !outOfStock ? "success" : "muted"}>{statusLabel}</MenuChip>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
