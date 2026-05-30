import React from "react";
import {
  EVENT_TYPE_OPTIONS,
  GROUP_SIZE_OPTIONS,
  PACKAGE_OPTIONS,
  VIP_REQUEST_OPTIONS
} from "./reservationPresets";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { ReservationStepHeader } from "./ReservationStepHeader";
import { ReservationPrimaryButton, ReservationSection, TapGrid, TapTile } from "./ReservationUi";

type Props = ReservationImmersiveShellProps & {
  eventTypeId: string;
  sizeId: string | null;
  pkgId: string | null;
  vipIds: Set<string>;
  onEventTypeId: (id: string) => void;
  onSizeId: (id: string) => void;
  onPkgId: (id: string) => void;
  onToggleVip: (id: string) => void;
  onSubmit: () => void;
};

export function GroupEventBookingScreen(props: Props) {
  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      footer={<ReservationPrimaryButton variant="purple" label="Send request" onPress={props.onSubmit} />}
    >
      <ReservationStepHeader stepLabel="Large party" title="Group & events" />

      <ReservationSection title="Event type">
        {EVENT_TYPE_OPTIONS.map((e) => (
          <TapTile
            key={e.id}
            label={e.label}
            selected={props.eventTypeId === e.id}
            onPress={() => props.onEventTypeId(e.id)}
          />
        ))}
      </ReservationSection>

      <ReservationSection title="How many guests?">
        <TapGrid options={GROUP_SIZE_OPTIONS} selectedId={props.sizeId} onSelect={(id) => props.onSizeId(id)} />
      </ReservationSection>

      <ReservationSection title="Package">
        {PACKAGE_OPTIONS.map((p) => (
          <TapTile
            key={p.id}
            label={p.label}
            selected={props.pkgId === p.id}
            onPress={() => props.onPkgId(p.id)}
          />
        ))}
      </ReservationSection>

      <ReservationSection title="Special requests">
        {VIP_REQUEST_OPTIONS.map((v) => (
          <TapTile
            key={v.id}
            label={v.label}
            selected={props.vipIds.has(v.id)}
            onPress={() => props.onToggleVip(v.id)}
          />
        ))}
      </ReservationSection>
    </ReservationImmersiveStepShell>
  );
}
