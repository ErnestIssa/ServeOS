import { useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import { AdminBtnPrimary } from "../../AdminUi";
import { MediaPickerModal } from "../media/MediaPickerModal";
import { filterUserCreatedWindows, formatAvailabilityDays } from "./availabilityHelpers";
import { menuHealthWarnings } from "./detailsHealth";
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

type MenuPanelVariant = "active" | "live" | "archived";

type Props = {
  menu: MenuSurfaceRow | null;
  open: boolean;
  venueName: string;
  variant: MenuPanelVariant;
  token: string;
  restaurantId: string;
  canUpload: boolean;
  onClose: () => void;
  onCoverChanged?: () => void;
};

function menuDescription(menu: MenuSurfaceRow, venueName: string) {
  if (menu.description?.trim()) return menu.description.trim();
  switch (menu.surfaceKey) {
    case "main":
      return `Default guest menu for ${venueName || "this venue"}`;
    case "lunch":
      return "Weekday lunch service — schedule when multi-menu is enabled";
    case "dinner":
      return "Evening dining — share categories or build a dedicated set";
    case "drinks":
      return "Beverages, cocktails, and bar service";
    case "seasonal":
      return "Rotating seasonal items and limited-time offers";
    default:
      return `Draft menu surface for ${venueName || "this venue"}`;
  }
}

function statusLabel(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "Published";
  if (status === "RETIRED") return "Retired";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

function statusClass(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "admin-menu-surface-status--live";
  if (status === "RETIRED") return "admin-menu-surface-status--retired";
  if (status === "ARCHIVED") return "admin-menu-surface-status--archived";
  return "admin-menu-surface-status--draft";
}

function lifecycleLabel(menu: MenuSurfaceRow) {
  if (menu.status === "ARCHIVED") return "Archived";
  if (menu.status === "RETIRED") return "Retired";
  if (menu.releaseState === "scheduled") return "Scheduled";
  if (menu.status === "PUBLISHED") return "Active";
  return "Draft workspace";
}

export function MenuProfileDrawer({
  menu,
  open,
  venueName,
  variant,
  token,
  restaurantId,
  canUpload,
  onClose,
  onCoverChanged
}: Props) {
  const active = useCachedDetailsEntity(open, menu);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const windows = active ? filterUserCreatedWindows(active.availabilityWindows) : {};
  const windowSummaries = Object.values(windows).map((w) => {
    const days = formatAvailabilityDays(w.days ?? []);
    return `${w.label || "Window"} · ${days} · ${w.start}–${w.end}${w.enabled ? "" : " (disabled)"}`;
  });
  const warnings = active ? menuHealthWarnings(active) : [];
  const live = active?.status === "PUBLISHED";
  const guestVisible = Boolean(live);
  const availabilityCount = windowSummaries.length;

  return (
    <>
    <DetailsDrawerShell
      open={open}
      entityKey={active?.id ?? null}
      title={active?.name ?? "Menu"}
      subtitle={active ? menuDescription(active, venueName) : undefined}
      badge={
        active ? (
          <>
            <span className={`admin-menu-surface-status ${statusClass(active.status)}`}>
              {statusLabel(active.status)}
            </span>
            {active.surfaceKey ? (
              <span className="admin-staff-profile-meta">Type: {active.surfaceKey}</span>
            ) : null}
          </>
        ) : null
      }
      closeLabel="Close menu details"
      onClose={onClose}
    >
      {active ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Name" value={active.name} />
              <DetailsInternalId id={active.id} />
              <DetailsRow
                label="Type"
                value={active.surfaceKey ? `Surface · ${active.surfaceKey}` : "Custom menu"}
              />
              <DetailsRow label="Status" value={statusLabel(active.status)} />
              <DetailsRow label="Lifecycle" value={lifecycleLabel(active)} />
              <DetailsRow label="Created" value={formatDetailsWhen(active.createdAt)} />
              <DetailsRow label="Last updated" value={formatDetailsWhen(active.updatedAt)} />
              <DetailsRow label="Venue" value={venueName || "—"} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Where it is used">
            <DetailsFlags
              flags={[
                {
                  label: "Guest ordering",
                  ok: guestVisible,
                  note: guestVisible ? "Currently live for guests" : "Not live for guests"
                },
                {
                  label: "Active version",
                  ok: Boolean(active.activeVersionNumber),
                  note: active.activeVersionNumber
                    ? `Version ${active.activeVersionNumber}`
                    : "No published version yet"
                },
                {
                  label: "Availability schedule",
                  ok: availabilityCount > 0,
                  note: availabilityCount > 0 ? `${availabilityCount} window(s)` : "No schedule windows"
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Customer visibility" hint="Can guests buy from this menu right now?">
            <DetailsFlags
              flags={[
                { label: "Published to guests", ok: guestVisible },
                {
                  label: "Not retired or archived",
                  ok: active.status !== "RETIRED" && active.status !== "ARCHIVED"
                },
                {
                  label: "Live snapshot in sync",
                  ok: !active.hasUnpublishedChanges,
                  note: active.hasUnpublishedChanges
                    ? `${active.draftChangeCount ?? 0} change(s) waiting`
                    : "In sync with live"
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Availability summary">
            {windowSummaries.length === 0 ? (
              <p className="admin-menu-details-prose admin-staff-profile-muted">
                No availability windows configured.
              </p>
            ) : (
              <DetailsChipList items={windowSummaries} />
            )}
          </DetailsSection>

          <DetailsSection title="Statistics">
            <DetailsGrid>
              <DetailsRow label="Categories" value={String(active.categoryCount)} />
              <DetailsRow label="Items" value={String(active.itemCount)} />
              <DetailsRow label="Availability windows" value={String(availabilityCount)} />
              <DetailsRow label="Cover image" value={active.coverMediaKey ? "Set" : "Missing"} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection
            title="Cover media"
            hint="Choose from the Media Library or upload a new cover for this menu."
          >
            <p className="admin-menu-details-prose admin-staff-profile-muted mb-3">
              {active.coverMediaKey
                ? "A cover is attached. Replace it anytime from the library."
                : "No cover yet — guests see a better menu when one is set."}
            </p>
            <AdminBtnPrimary className="w-full" onClick={() => setCoverPickerOpen(true)}>
              {active.coverMediaKey ? "Change cover" : "Choose cover"}
            </AdminBtnPrimary>
          </DetailsSection>

          <DetailsSection title="Relationships">
            <DetailsFlags
              flags={[
                {
                  label: "Contains categories",
                  ok: active.categoryCount > 0,
                  note: `${active.categoryCount} categor${active.categoryCount === 1 ? "y" : "ies"}`
                },
                {
                  label: "Contains items",
                  ok: active.itemCount > 0,
                  note: `${active.itemCount} item${active.itemCount === 1 ? "" : "s"}`
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Publishing" hint="What customers actually see.">
            <DetailsGrid>
              <DetailsRow label="Release state" value={active.releaseLabel ?? statusLabel(active.status)} />
              <DetailsRow
                label="Current published version"
                value={active.activeVersionNumber ? String(active.activeVersionNumber) : "—"}
              />
              <DetailsRow label="Published" value={formatDetailsWhen(active.publishedAt)} />
              <DetailsRow label="Next release" value={formatDetailsWhen(active.scheduledPublishAt)} />
              <DetailsRow label="Scheduled retirement" value={formatDetailsWhen(active.scheduledRetireAt)} />
              <DetailsRow
                label="Changes waiting"
                value={active.hasUnpublishedChanges ? String(active.draftChangeCount ?? 0) : "None"}
              />
            </DetailsGrid>
            {variant === "active" && active.status === "DRAFT" ? (
              <p className="admin-staff-drawer-hint mt-3">
                Edits stay in the draft workspace. Schedule a release or publish changes to go live.
              </p>
            ) : null}
            {active.status === "PUBLISHED" && active.hasUnpublishedChanges ? (
              <p className="admin-staff-drawer-hint mt-3">
                Guests still see version {active.activeVersionNumber ?? "—"}. Publish to release a new version.
              </p>
            ) : null}
          </DetailsSection>

          <DetailsSection title="Dependencies" hint="If you delete or retire this menu, these counts are affected.">
            <DetailsGrid>
              <DetailsRow label="Categories affected" value={String(active.categoryCount)} />
              <DetailsRow label="Items affected" value={String(active.itemCount)} />
              <DetailsRow label="Availability windows" value={String(availabilityCount)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          {active.description?.trim() ? (
            <DetailsSection title="Description">
              <p className="admin-menu-details-prose">{active.description.trim()}</p>
            </DetailsSection>
          ) : null}

          <DetailsSystemStatus
            rows={[
              { label: "Public visibility", ok: guestVisible, note: guestVisible ? "Visible" : "Not visible" },
              {
                label: "Published",
                ok: guestVisible,
                note: active.activeVersionNumber
                  ? `Version ${active.activeVersionNumber}`
                  : statusLabel(active.status)
              },
              {
                label: "Availability",
                ok: availabilityCount > 0 || !live,
                note:
                  availabilityCount > 0
                    ? `${availabilityCount} window(s)`
                    : live
                      ? "No schedule"
                      : "N/A while draft"
              },
              {
                label: "Cover media",
                ok: Boolean(active.coverMediaKey),
                note: active.coverMediaKey ? "Cover set" : "Missing cover"
              },
              {
                label: "Content",
                ok: active.categoryCount > 0 && active.itemCount > 0,
                note: `${active.categoryCount} categories · ${active.itemCount} items`
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
    {active ? (
      <MediaPickerModal
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        token={token}
        restaurantId={restaurantId}
        canUpload={canUpload}
        menus={[active]}
        items={[]}
        attachTarget={{ targetType: "MENU_COVER", targetId: active.id }}
        onAttached={() => {
          setCoverPickerOpen(false);
          onCoverChanged?.();
        }}
      />
    ) : null}
    </>
  );
}
