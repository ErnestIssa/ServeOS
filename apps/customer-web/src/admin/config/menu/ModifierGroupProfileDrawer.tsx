import { modifierGroupHealthWarnings } from "./detailsHealth";
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
  modifierGroupStatusClass,
  modifierGroupStatusLabel,
  type ModifierGroupListRow
} from "./modifierGroupListHelpers";

type Props = {
  group: ModifierGroupListRow | null;
  open: boolean;
  venueName: string;
  onClose: () => void;
};

export function ModifierGroupProfileDrawer({ group, open, venueName, onClose }: Props) {
  const active = useCachedDetailsEntity(open, group);
  const warnings = active ? modifierGroupHealthWarnings(active) : [];
  const required = Boolean(active && active.minSelect > 0);
  const multi = Boolean(active && active.maxSelect > 1);

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active?.id ?? null}
      title={active?.name ?? "Modifier group"}
      subtitle={active ? `Modifier group at ${venueName}` : undefined}
      badge={
        active ? (
          <span className={`admin-menu-surface-status ${modifierGroupStatusClass(active)}`}>
            {modifierGroupStatusLabel(active)}
          </span>
        ) : null
      }
      closeLabel="Close modifier group details"
      onClose={onClose}
    >
      {active ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Name" value={active.name} />
              <DetailsInternalId id={active.id} />
              <DetailsRow label="Type" value="Modifier group" />
              <DetailsRow label="Status" value={modifierGroupStatusLabel(active)} />
              <DetailsRow label="Lifecycle" value={active.lifecycle} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Where it is used">
            <DetailsFlags
              flags={[
                {
                  label: "Parent item",
                  ok: Boolean(active.itemId),
                  note: active.itemName
                },
                {
                  label: "Options",
                  ok: active.optionCount > 0,
                  note: `${active.optionCount} option${active.optionCount === 1 ? "" : "s"}`
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Customer visibility" hint="How guests interact with this group.">
            <DetailsFlags
              flags={[
                {
                  label: required ? "Required selection" : "Optional selection",
                  ok: true,
                  note: `Min ${active.minSelect} · Max ${active.maxSelect}`
                },
                {
                  label: multi ? "Allows multi-select" : "Single-select",
                  ok: true,
                  note: `Max ${active.maxSelect}`
                },
                {
                  label: "Group active",
                  ok: active.lifecycle === "ACTIVE",
                  note: modifierGroupStatusLabel(active)
                }
              ]}
            />
          </DetailsSection>

          <DetailsSection title="Selection rules">
            <DetailsGrid>
              <DetailsRow label="Min select" value={String(active.minSelect)} />
              <DetailsRow label="Max select" value={String(active.maxSelect)} />
              <DetailsRow label="Options" value={String(active.optionCount)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Relationships">
            <DetailsGrid>
              <DetailsRow label="Used by item" value={active.itemName} />
              <DetailsRow
                label="Contains"
                value={`${active.optionCount} option${active.optionCount === 1 ? "" : "s"}`}
              />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Dependencies" hint="Deleting this group affects the parent item and options.">
            <DetailsGrid>
              <DetailsRow label="Parent item" value={active.itemName} />
              <DetailsRow label="Options affected" value={String(active.optionCount)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Health">
            <DetailsHealth ready={warnings.length === 0} warnings={warnings} />
          </DetailsSection>

          <DetailsSystemStatus
            rows={[
              {
                label: "Attached to item",
                ok: Boolean(active.itemId),
                note: active.itemName
              },
              {
                label: "Selection rules",
                ok: active.minSelect <= active.maxSelect,
                note: `Min ${active.minSelect} · Max ${active.maxSelect}`
              },
              {
                label: "Options",
                ok: active.optionCount > 0,
                note: `${active.optionCount} option${active.optionCount === 1 ? "" : "s"}`
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
