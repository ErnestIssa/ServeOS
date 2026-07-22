import { formatMoneyCents } from "@serveos/core-shared/currency";
import type { MenuSectionTab } from "../configRouting";
import { AdminBtnPrimary } from "../../AdminUi";
import { MenuChip } from "./MenuPageUi";
import { itemHealthWarnings } from "./detailsHealth";
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
  useCachedDetailsEntity
} from "./detailsDrawerUi";
import { itemStatusClass, itemStatusLabel, type ItemListRow } from "./itemListHelpers";

type Props = {
  item: ItemListRow | null;
  open: boolean;
  venueName: string;
  onClose: () => void;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

export function MenuItemProfileDrawer({ item, open, venueName, onClose, onNavigateTab }: Props) {
  const active = useCachedDetailsEntity(open, item);
  const warnings = active ? itemHealthWarnings(active) : [];
  const onLiveMenu = active?.menuStatus === "PUBLISHED";
  const guestBuyable = Boolean(
    active && active.isActive && !active.isSoldOut && active.lifecycle === "ACTIVE" && onLiveMenu
  );

  const goToMediaTab = () => {
    onClose();
    onNavigateTab("images");
  };

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active?.id ?? null}
      title={active?.name ?? "Item"}
      subtitle={active ? `${active.categoryName} · ${venueName}` : undefined}
      badge={
        active ? (
          <>
            <span className={`admin-menu-surface-status ${itemStatusClass(active)}`}>
              {itemStatusLabel(active)}
            </span>
            <MenuChip tone="muted">{formatMoneyCents(active.priceCents)}</MenuChip>
          </>
        ) : null
      }
      closeLabel="Close item details"
      onClose={onClose}
    >
      {active ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Name" value={active.name} />
              <DetailsInternalId id={active.id} />
              <DetailsRow label="Type" value="Menu item" />
              <DetailsRow label="Status" value={itemStatusLabel(active)} />
              <DetailsRow label="Lifecycle" value={active.lifecycle} />
              <DetailsRow label="Sort order" value={String(active.sortOrder)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Pricing snapshot">
            <DetailsGrid>
              <DetailsRow label="Base price" value={formatMoneyCents(active.priceCents)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Where it is used">
            <DetailsFlags
              flags={[
                { label: "Category", ok: true, note: active.categoryName },
                {
                  label: "Menu",
                  ok: Boolean(active.menuId),
                  note: active.menuName
                },
                {
                  label: "On live menu",
                  ok: onLiveMenu,
                  note: onLiveMenu ? "Published" : active.menuStatus
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Customer visibility" hint="Can customers buy this?">
            <DetailsFlags
              flags={[
                { label: "Item shown", ok: active.isActive },
                { label: "Not sold out", ok: !active.isSoldOut },
                { label: "Lifecycle active", ok: active.lifecycle === "ACTIVE" },
                { label: "Parent menu live", ok: onLiveMenu },
                {
                  label: "Orderable for guests",
                  ok: guestBuyable,
                  note: guestBuyable ? "Guests can order this" : "Not orderable right now"
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Guest-facing copy">
            <DetailsGrid>
              <DetailsRow label="Description" value={active.description?.trim() || "—"} />
              <DetailsRow label="Ingredients" value={active.ingredients?.trim() || "—"} />
              <DetailsRow label="Special notes" value={active.specialNotes?.trim() || "—"} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Statistics">
            <DetailsGrid>
              <DetailsRow label="Modifier groups" value={String(active.modifierCount)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Relationships">
            <DetailsChipList
              items={[
                `Category · ${active.categoryName}`,
                `Menu · ${active.menuName}`,
                `${active.modifierCount} modifier group${active.modifierCount === 1 ? "" : "s"}`
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Dependencies" hint="Deleting this item affects attached modifiers.">
            <DetailsGrid>
              <DetailsRow label="Modifier groups affected" value={String(active.modifierCount)} />
              <DetailsRow label="Category" value={active.categoryName} />
              <DetailsRow label="Menu" value={active.menuName} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection
            title="Media"
            hint="Photos and videos stay on the Images tab — not inside this details drawer."
          >
            <p className="admin-menu-details-prose admin-staff-profile-muted mb-3">
              Use Images to upload, set cover, or remove media for this item.
            </p>
            <AdminBtnPrimary className="w-full" onClick={goToMediaTab}>
              Open Images tab
            </AdminBtnPrimary>
          </DetailsSection>

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          <DetailsSystemStatus
            rows={[
              {
                label: "Public visibility",
                ok: guestBuyable,
                note: guestBuyable ? "Visible & orderable" : "Not orderable"
              },
              {
                label: "Published menu",
                ok: onLiveMenu,
                note: onLiveMenu ? "Parent menu live" : active.menuStatus
              },
              {
                label: "Availability",
                ok: active.isActive && !active.isSoldOut,
                note: itemStatusLabel(active)
              },
              {
                label: "Modifiers",
                ok: active.modifierCount > 0,
                note: `${active.modifierCount} group${active.modifierCount === 1 ? "" : "s"}`
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
