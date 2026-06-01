import React from "react";
import { ReservationDetailCardCarousel } from "./ReservationDetailCardCarousel";
import { ACCESSIBILITY_CARD_OPTIONS, type AccessibilityCardOption } from "./reservationPresets";

type Props = {
  selectedIds: string[];
  onSelect: (option: AccessibilityCardOption) => void;
};

export function ReservationAccessibilityCarousel({ selectedIds, onSelect }: Props) {
  return (
    <ReservationDetailCardCarousel
      options={ACCESSIBILITY_CARD_OPTIONS}
      selectedIds={selectedIds}
      onSelect={(opt) => onSelect(opt as AccessibilityCardOption)}
    />
  );
}
