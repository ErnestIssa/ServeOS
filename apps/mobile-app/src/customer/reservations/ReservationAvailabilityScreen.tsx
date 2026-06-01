import React from "react";
import { BOOK_NOTE_FOOTER_SCROLL_REVEAL_PX } from "./reservationImmersiveMetrics";
import { RESERVATION_BOOK_STEP_NUMBER } from "./reservationBookSteps";
import { ReservationBookingNoteComposer } from "./ReservationBookingNoteComposer";
import { ReservationBookStepShell } from "./ReservationBookStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import type { ReservationDraft } from "./reservationTypes";

type Props = ReservationImmersiveShellProps & {
  draft: ReservationDraft;
  onChange: (patch: Partial<ReservationDraft>) => void;
  onConfirm: () => void;
  confirmLoading?: boolean;
  hasVenue: boolean;
};

export function ReservationAvailabilityScreen(props: Props) {
  const { draft, onChange } = props;
  const inputRef = React.useRef<import("react-native").TextInput | null>(null);

  return (
    <ReservationBookStepShell
      {...immersiveShellPassThrough(props)}
      bookStep={RESERVATION_BOOK_STEP_NUMBER.availability}
      draft={draft}
      onDraftChange={onChange}
      hasVenue={props.hasVenue}
      sectionTitle="Note for the restaurant"
      footerLabel="Confirm booking"
      footerLoading={props.confirmLoading}
      onFooterPress={props.onConfirm}
      footerScrollRevealGap={BOOK_NOTE_FOOTER_SCROLL_REVEAL_PX}
      footerScrollRevealKeyboardOnly
    >
      <ReservationBookingNoteComposer
        inputRef={inputRef}
        value={draft.restaurantNote}
        onChange={(restaurantNote) => onChange({ restaurantNote })}
        disabled={!props.hasVenue}
      />
    </ReservationBookStepShell>
  );
}
