import React from "react";
import { RESERVATION_BOOK_STEP_NUMBER } from "./reservationBookSteps";
import { ReservationAccessibilityCarousel } from "./ReservationAccessibilityCarousel";
import { toggleAccessibilityNoteId } from "./accessibilitySelection";
import { ReservationBookSection, ReservationBookStepShell } from "./ReservationBookStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import type { ReservationDraft } from "./reservationTypes";

type Props = ReservationImmersiveShellProps & {
  draft: ReservationDraft;
  onChange: (patch: Partial<ReservationDraft>) => void;
  onContinue: () => void;
  continueLoading?: boolean;
  hasVenue: boolean;
};

export function ReservationBuilderScreen(props: Props) {
  const { draft, onChange } = props;

  return (
    <ReservationBookStepShell
      {...immersiveShellPassThrough(props)}
      bookStep={RESERVATION_BOOK_STEP_NUMBER.builder}
      draft={draft}
      onDraftChange={onChange}
      hasVenue={props.hasVenue}
      sectionTitle="Build your visit"
      footerLabel="Check availability"
      footerLoading={props.continueLoading}
      onFooterPress={props.onContinue}
    >
      <ReservationBookSection title="Accessibility" first>
        <ReservationAccessibilityCarousel
          selectedIds={draft.accessibilityNoteIds}
          onSelect={(opt) =>
            onChange({
              accessibilityNoteIds: toggleAccessibilityNoteId(draft.accessibilityNoteIds, opt)
            })
          }
        />
      </ReservationBookSection>
    </ReservationBookStepShell>
  );
}
