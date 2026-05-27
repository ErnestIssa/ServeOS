import React from "react";
import {
  EVENT_TYPE_OPTIONS,
  GROUP_SIZE_OPTIONS,
  PACKAGE_OPTIONS,
  VIP_REQUEST_OPTIONS
} from "./reservationPresets";
import {
  ReservationGhostButton,
  ReservationPrimaryButton,
  ReservationSection,
  TapGrid,
  TapTile
} from "./ReservationUi";
import { ReservationScreenShell } from "./ReservationScreenShell";
import type { ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext & {
  onScroll: ReturnType<typeof import("react-native").Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onBack: () => void;
  onSubmit: () => void;
};

export function GroupEventBookingScreen(props: Props) {
  const [eventTypeId, setEventTypeId] = React.useState<string>(EVENT_TYPE_OPTIONS[0].id);
  const [sizeId, setSizeId] = React.useState<string | null>(null);
  const [pkgId, setPkgId] = React.useState<string | null>(null);
  const [vipIds, setVipIds] = React.useState<Set<string>>(new Set());

  const toggleVip = (id: string) => {
    setVipIds((prev) => {
      const next = new Set(prev);
      if (id === "none") return new Set(["none"]);
      next.delete("none");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ReservationScreenShell
      title="Group & events"
      stepLabel="Large party"
      onBack={props.onBack}
      onScroll={props.onScroll}
      scrollTopPad={props.scrollTopPad}
      scrollBottom={props.scrollBottom}
      footer={
        <>
          <ReservationPrimaryButton label="Send request" onPress={props.onSubmit} disabled={!sizeId} />
          <ReservationGhostButton label="Standard table booking" onPress={props.onBack} />
        </>
      }
    >
      <ReservationSection title="Event type">
        {EVENT_TYPE_OPTIONS.map((e) => (
          <TapTile
            key={e.id}
            label={e.label}
            selected={eventTypeId === e.id}
            onPress={() => setEventTypeId(e.id)}
          />
        ))}
      </ReservationSection>

      <ReservationSection title="How many guests?">
        <TapGrid
          options={GROUP_SIZE_OPTIONS}
          selectedId={sizeId}
          onSelect={(id) => setSizeId(id)}
        />
      </ReservationSection>

      <ReservationSection title="Package">
        {PACKAGE_OPTIONS.map((p) => (
          <TapTile
            key={p.id}
            label={p.label}
            selected={pkgId === p.id}
            onPress={() => setPkgId(p.id)}
          />
        ))}
      </ReservationSection>

      <ReservationSection title="Special requests">
        {VIP_REQUEST_OPTIONS.map((v) => (
          <TapTile
            key={v.id}
            label={v.label}
            selected={vipIds.has(v.id)}
            onPress={() => toggleVip(v.id)}
          />
        ))}
      </ReservationSection>
    </ReservationScreenShell>
  );
}
