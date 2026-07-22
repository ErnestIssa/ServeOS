import {
  categoryPublishClass,
  categoryPublishLabel,
  categoryVisibilityLabel,
  type CategoryListRow
} from "./categoryListHelpers";
import { categoryHealthWarnings } from "./detailsHealth";
import {
  DetailsDrawerShell,
  DetailsFlags,
  DetailsGrid,
  DetailsHealth,
  DetailsInternalId,
  DetailsRow,
  DetailsSection,
  DetailsSystemStatus,
  useCachedDetailsEntity
} from "./detailsDrawerUi";

type Props = {
  category: CategoryListRow | null;
  open: boolean;
  venueName: string;
  onClose: () => void;
};

export function CategoryProfileDrawer({ category, open, venueName, onClose }: Props) {
  const active = useCachedDetailsEntity(open, category);
  const warnings = active ? categoryHealthWarnings(active) : [];
  const onLiveMenu = active?.menuStatus === "PUBLISHED";
  const guestVisible = Boolean(active?.isActive && onLiveMenu);

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active?.id ?? null}
      title={active?.name ?? "Category"}
      subtitle={active ? `Category at ${venueName}` : undefined}
      badge={
        active ? (
          <>
            <span className={`admin-menu-surface-status ${categoryPublishClass(active.menuStatus)}`}>
              {categoryPublishLabel(active.menuStatus)}
            </span>
            <span className="admin-staff-profile-meta">{categoryVisibilityLabel(active.isActive)}</span>
          </>
        ) : null
      }
      closeLabel="Close category details"
      onClose={onClose}
    >
      {active ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Name" value={active.name} />
              <DetailsInternalId id={active.id} />
              <DetailsRow label="Type" value="Category" />
              <DetailsRow label="Status" value={categoryVisibilityLabel(active.isActive)} />
              <DetailsRow label="Lifecycle" value={active.isActive ? "Active" : "Hidden"} />
              <DetailsRow label="Sort order" value={String(active.sortOrder)} />
              <DetailsRow label="Venue" value={venueName || "—"} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Where it is used">
            <DetailsFlags
              flags={[
                {
                  label: "Parent menu",
                  ok: Boolean(active.menuId),
                  note: active.menuName
                },
                {
                  label: "On live menu",
                  ok: onLiveMenu,
                  note: categoryPublishLabel(active.menuStatus)
                },
                {
                  label: "Contains items",
                  ok: active.itemCount > 0,
                  note: `${active.itemCount} item${active.itemCount === 1 ? "" : "s"}`
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Customer visibility" hint="Can guests see this category?">
            <DetailsFlags
              flags={[
                { label: "Category visible", ok: active.isActive },
                { label: "Parent menu published", ok: onLiveMenu },
                {
                  label: "Shown to guests",
                  ok: guestVisible,
                  note: guestVisible ? "Visible when browsing the live menu" : "Not shown to guests"
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Statistics">
            <DetailsGrid>
              <DetailsRow label="Item count" value={String(active.itemCount)} />
              <DetailsRow label="Sort order" value={String(active.sortOrder)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Relationships">
            <DetailsGrid>
              <DetailsRow label="Belongs to menu" value={active.menuName} />
              <DetailsRow
                label="Contains"
                value={`${active.itemCount} item${active.itemCount === 1 ? "" : "s"}`}
              />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Dependencies" hint="Deleting this category affects these items.">
            <DetailsGrid>
              <DetailsRow label="Items affected" value={String(active.itemCount)} />
              <DetailsRow label="Parent menu" value={active.menuName} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          <DetailsSection title="Description">
            <p className="admin-menu-details-prose">
              {active.description?.trim() || "No description yet."}
            </p>
          </DetailsSection>

          <DetailsSystemStatus
            rows={[
              { label: "Public visibility", ok: guestVisible, note: guestVisible ? "Visible" : "Hidden" },
              {
                label: "Parent menu",
                ok: onLiveMenu,
                note: categoryPublishLabel(active.menuStatus)
              },
              {
                label: "Content",
                ok: active.itemCount > 0,
                note: `${active.itemCount} item${active.itemCount === 1 ? "" : "s"}`
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
