import { formatMoneyCents } from "@serveos/core-shared/currency";
import { modifierOptionHealthWarnings } from "./detailsHealth";
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
import {
  modifierOptionStatusClass,
  modifierOptionStatusLabel,
  type ModifierOptionListRow
} from "./modifierOptionListHelpers";

type Props = {
  option: ModifierOptionListRow | null;
  open: boolean;
  venueName: string;
  onClose: () => void;
};

function priceImpactLabel(cents: number) {
  if (cents === 0) return "No price change";
  const formatted = formatMoneyCents(Math.abs(cents));
  return cents > 0 ? `+${formatted}` : `−${formatted}`;
}

export function ModifierOptionProfileDrawer({ option, open, venueName, onClose }: Props) {
  const active = useCachedDetailsEntity(open, option);
  const warnings = active ? modifierOptionHealthWarnings(active) : [];
  const guestSelectable = Boolean(active && active.isActive && active.lifecycle === "ACTIVE");

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active?.id ?? null}
      title={active?.name ?? "Modifier option"}
      subtitle={active ? `Option at ${venueName}` : undefined}
      badge={
        active ? (
          <span className={`admin-menu-surface-status ${modifierOptionStatusClass(active)}`}>
            {modifierOptionStatusLabel(active)}
          </span>
        ) : null
      }
      closeLabel="Close modifier option details"
      onClose={onClose}
    >
      {active ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Name" value={active.name} />
              <DetailsInternalId id={active.id} />
              <DetailsRow label="Type" value="Modifier option" />
              <DetailsRow label="Status" value={modifierOptionStatusLabel(active)} />
              <DetailsRow label="Lifecycle" value={active.lifecycle} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Where it is used">
            <DetailsFlags
              flags={[
                {
                  label: "Parent group",
                  ok: Boolean(active.groupId),
                  note: active.groupName
                },
                {
                  label: "Linked item",
                  ok: Boolean(active.itemName),
                  note: active.itemName
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Customer visibility" hint="Can guests select this option?">
            <DetailsFlags
              flags={[
                { label: "Available to guests", ok: active.isActive },
                { label: "Lifecycle active", ok: active.lifecycle === "ACTIVE" },
                {
                  label: "Selectable now",
                  ok: guestSelectable,
                  note: guestSelectable ? "Guests can pick this" : "Not selectable"
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Price impact">
            <DetailsGrid>
              <DetailsRow label="Price delta" value={priceImpactLabel(active.priceDeltaCents)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Relationships">
            <DetailsGrid>
              <DetailsRow label="Parent group" value={active.groupName} />
              <DetailsRow label="Linked item (via group)" value={active.itemName} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Dependencies" hint="Deleting this option affects the parent group and item.">
            <DetailsGrid>
              <DetailsRow label="Parent group" value={active.groupName} />
              <DetailsRow label="Linked item" value={active.itemName} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          <DetailsSystemStatus
            rows={[
              {
                label: "Public visibility",
                ok: guestSelectable,
                note: guestSelectable ? "Selectable" : "Not selectable"
              },
              {
                label: "Parent group",
                ok: Boolean(active.groupId),
                note: active.groupName
              },
              {
                label: "Price impact",
                ok: true,
                note: priceImpactLabel(active.priceDeltaCents)
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
