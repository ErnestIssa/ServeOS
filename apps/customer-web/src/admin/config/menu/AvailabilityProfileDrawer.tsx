import type { AvailabilityCardPayload } from "../../../api";
import {
  CHANNEL_LABELS,
  STATUS_LABELS,
  formatAvailabilityChannels,
  formatAvailabilityDays,
  formatAvailabilityLocations
} from "./availabilityHelpers";
import { availabilityHealthWarnings } from "./detailsHealth";
import {
  DetailsChipList,
  DetailsDrawerShell,
  DetailsFlags,
  DetailsGrid,
  DetailsHealth,
  DetailsInternalId,
  DetailsRow,
  DetailsSection,
  DetailsSystemStatus,
  formatDetailsWhen,
  useCachedDetailsEntity
} from "./detailsDrawerUi";

type Props = {
  card: AvailabilityCardPayload | null;
  open: boolean;
  timezone?: string | null;
  venueName: string;
  onClose: () => void;
};

function scheduleKindLabel(kind: AvailabilityCardPayload["window"]["scheduleKind"]) {
  if (kind === "TEMPORARY") return "Temporary";
  if (kind === "SEASONAL") return "Seasonal";
  return "Recurring";
}

export function AvailabilityProfileDrawer({ card, open, timezone, venueName, onClose }: Props) {
  const active = useCachedDetailsEntity(open, card);
  const warnings = active ? availabilityHealthWarnings(active) : [];
  const w = active?.window;
  const evaluation = active?.evaluation;
  const channels =
    w?.channels?.map((c) => CHANNEL_LABELS[c]) ??
    (w ? ["All channels"] : []);
  const history = (w?.history ?? []).slice(-5).reverse();
  const orderable = Boolean(evaluation?.orderable);

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active ? `${active.menuId}:${active.key}` : null}
      title={w?.label ?? "Availability"}
      subtitle={active ? `Schedule · ${active.menuName}` : undefined}
      badge={
        evaluation ? (
          <span
            className={`admin-menu-surface-status ${
              orderable ? "admin-menu-surface-status--live" : "admin-menu-surface-status--draft"
            }`}
          >
            {STATUS_LABELS[evaluation.status]}
          </span>
        ) : null
      }
      closeLabel="Close availability details"
      onClose={onClose}
    >
      {active && w && evaluation ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Schedule name" value={w.label} />
              <DetailsInternalId id={active.key} label="Window key" />
              <DetailsRow label="Type" value={scheduleKindLabel(w.scheduleKind)} />
              <DetailsRow label="Status" value={STATUS_LABELS[evaluation.status]} />
              <DetailsRow label="Enabled" value={w.enabled ? "Yes" : "No"} />
              <DetailsRow label="Venue" value={venueName || "—"} />
              <DetailsRow label="Timezone" value={timezone?.trim() || "—"} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Where it is used">
            <DetailsFlags
              flags={[
                {
                  label: "Parent menu",
                  ok: true,
                  note: active.menuName
                },
                {
                  label: "Menu published",
                  ok: active.menuStatus === "PUBLISHED",
                  note: active.menuStatus
                },
                {
                  label: "Locations",
                  ok: true,
                  note: formatAvailabilityLocations(w)
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Customer visibility" hint="Current evaluation for guests.">
            <DetailsFlags
              flags={[
                {
                  label: "Orderable now",
                  ok: orderable,
                  note: orderable ? "Available for ordering" : "Not orderable"
                },
                {
                  label: "Not out of stock",
                  ok: !w.outOfStock
                },
                {
                  label: "Not paused",
                  ok: !w.paused
                },
                {
                  label: "Guest visibility",
                  ok: (w.visibility ?? "CUSTOMERS") === "CUSTOMERS",
                  note: w.visibility ?? "CUSTOMERS"
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Availability summary">
            <DetailsGrid>
              <DetailsRow label="Days" value={formatAvailabilityDays(w.days ?? [])} />
              <DetailsRow label="Hours" value={`${w.start}–${w.end}`} />
              <DetailsRow label="Channels" value={formatAvailabilityChannels(w.channels)} />
              <DetailsRow label="Locations" value={formatAvailabilityLocations(w)} />
              {w.temporaryStartAt || w.temporaryEndAt ? (
                <DetailsRow
                  label="Temporary range"
                  value={`${formatDetailsWhen(w.temporaryStartAt)} → ${formatDetailsWhen(w.temporaryEndAt)}`}
                />
              ) : null}
              {w.seasonalStartMd || w.seasonalEndMd ? (
                <DetailsRow
                  label="Seasonal range"
                  value={`${w.seasonalStartMd ?? "—"} → ${w.seasonalEndMd ?? "—"}`}
                />
              ) : null}
            </DetailsGrid>
            {channels.length > 0 ? (
              <div className="mt-3">
                <DetailsChipList items={channels} />
              </div>
            ) : null}
          </DetailsSection>

          <DetailsSection title="Current evaluation">
            <DetailsGrid>
              <DetailsRow label="Status" value={STATUS_LABELS[evaluation.status]} />
              <DetailsRow label="Orderable" value={orderable ? "Yes" : "No"} />
              <DetailsRow label="Matched window" value={evaluation.matchedWindowKey ?? "—"} />
            </DetailsGrid>
            {evaluation.reasons.length > 0 ? (
              <ul className="admin-menu-details-health-list mt-3">
                {evaluation.reasons.map((r) => (
                  <li key={`${r.code}-${r.label}`}>
                    {r.ok ? "✓" : "✕"} {r.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </DetailsSection>

          <DetailsSection title="Statistics">
            <DetailsGrid>
              <DetailsRow label="Active days" value={String(w.days?.length ?? 0)} />
              <DetailsRow
                label="Channels scoped"
                value={w.channels?.length ? String(w.channels.length) : "All"}
              />
              <DetailsRow label="Audit events" value={String(w.history?.length ?? 0)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Dependencies">
            <DetailsGrid>
              <DetailsRow label="Parent menu" value={active.menuName} />
              <DetailsRow label="Menu status" value={active.menuStatus} />
            </DetailsGrid>
          </DetailsSection>

          {history.length > 0 ? (
            <DetailsSection title="Recent audit" hint="Latest schedule events from the backend.">
              <ul className="admin-menu-details-health-list">
                {history.map((entry, idx) => (
                  <li key={`${entry.at}-${entry.action}-${idx}`}>
                    {entry.action}
                    {entry.detail ? ` · ${entry.detail}` : ""}
                    {" · "}
                    {formatDetailsWhen(entry.at)}
                  </li>
                ))}
              </ul>
            </DetailsSection>
          ) : null}

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          <DetailsSystemStatus
            rows={[
              {
                label: "Orderable now",
                ok: orderable,
                note: STATUS_LABELS[evaluation.status]
              },
              {
                label: "Schedule enabled",
                ok: w.enabled
              },
              {
                label: "Parent menu live",
                ok: active.menuStatus === "PUBLISHED",
                note: active.menuStatus
              },
              {
                label: "Channels",
                ok: true,
                note: formatAvailabilityChannels(w.channels)
              },
              {
                label: "Health",
                ok: warnings.length === 0,
                note: warnings.length === 0 ? "No issues detected" : `${warnings.length} warning(s)`
              }
            ]}
          />
        </>
      ) : null}
    </DetailsDrawerShell>
  );
}
