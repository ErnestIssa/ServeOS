import React from "react";
import { TABLE_OPTIONS, TIME_OPTIONS } from "./reservationPresets";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { ReservationStepHeader } from "./ReservationStepHeader";
import {
  ReservationMapPlaceholder,
  ReservationPrimaryButton,
  ReservationSection,
  TapGrid,
  TapTile
} from "./ReservationUi";
import type { ReservationDraft } from "./reservationTypes";

type Props = ReservationImmersiveShellProps & {
  draft: ReservationDraft;
  onChange: (patch: Partial<ReservationDraft>) => void;
  onContinue: () => void;
  onWaitlist: () => void;
};

function slotId(label: string | null): string | null {
  if (!label) return null;
  return TIME_OPTIONS.find((t) => t.label === label)?.id ?? label;
}

export function ReservationAvailabilityScreen(props: Props) {
  const { draft, onChange } = props;
  const selectedSlot = slotId(draft.slotLabel ?? draft.timeLabel);

  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      footer={
        <ReservationPrimaryButton variant="purple" label="Continue" onPress={props.onContinue} />
      }
    >
      <ReservationStepHeader
        stepLabel="Step 2 · Availability"
        title="Pick a time & table"
        subtitle={`${draft.guests} guests · ${draft.dateLabel}`}
      />

      <ReservationSection title="Available times">
        <TapGrid
          columns={3}
          options={TIME_OPTIONS}
          selectedId={selectedSlot}
          onSelect={(_, label) => onChange({ slotLabel: label, timeLabel: label })}
        />
      </ReservationSection>

      <ReservationSection title="Floor zones">
        <ReservationMapPlaceholder
          selectedId={draft.tableId?.toLowerCase() ?? null}
          onSelectTable={(id, label) => onChange({ tableId: label })}
        />
      </ReservationSection>

      <ReservationSection title="Recommended tables">
        {TABLE_OPTIONS.map((t) => (
          <TapTile
            key={t.id}
            label={t.label}
            sublabel={t.sublabel}
            selected={draft.tableId === t.label}
            onPress={() => onChange({ tableId: t.label })}
          />
        ))}
      </ReservationSection>

      <TapTile
        label="Nothing works? Join waitlist"
        sublabel="We'll text you when a table opens"
        accent="muted"
        selected={draft.slotLabel === "Waitlist"}
        onPress={props.onWaitlist}
      />
    </ReservationImmersiveStepShell>
  );
}
