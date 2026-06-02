import React from "react";
import { Text, View } from "react-native";
import { ReservationImmersiveStepShell } from "./ReservationImmersiveStepShell";
import { ReservationPrimaryButton } from "./ReservationUi";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { reservationBookStyles as styles } from "./reservationBookStyles";
import { useAppTheme } from "../../theme/AppThemeContext";
import type { ReservationDraft } from "./reservationTypes";

export function ReservationBookSection(props: { title: string; first?: boolean; children: React.ReactNode }) {
  const { colors: t } = useAppTheme();
  return (
    <>
      <Text
        style={[
          styles.sectionSubtitle,
          !props.first && styles.sectionSubtitleFollow,
          { color: t.ordersNavPurpleBright }
        ]}
      >
        {props.title}
      </Text>
      {props.children}
    </>
  );
}

type Props = ReservationImmersiveShellProps & {
  /** Omitted on confirmation (read-only — no step indicator). */
  bookStep?: number;
  draft: ReservationDraft;
  onDraftChange: (patch: Partial<ReservationDraft>) => void;
  hasVenue: boolean;
  sectionTitle: string;
  footerLabel: string;
  footerLoading?: boolean;
  onFooterPress: () => void;
  footer?: React.ReactNode;
  /** Scroll padding below footer — note step only, tied to keyboard. */
  footerScrollRevealGap?: number;
  footerScrollRevealKeyboardOnly?: boolean;
  children: React.ReactNode;
};

/** Shared step 2+ chrome: section title + purple footer. */
export function ReservationBookStepShell(props: Props) {
  const { colors: t } = useAppTheme();

  const footer =
    props.footer ?? (
      <ReservationPrimaryButton
        variant="purple"
        label={props.footerLabel}
        loading={props.footerLoading}
        onPress={props.onFooterPress}
      />
    );

  return (
    <ReservationImmersiveStepShell
      {...immersiveShellPassThrough(props)}
      bookStep={props.bookStep}
      cardOverlayBack={props.cardOverlayBack}
      cardOverlayClose={props.cardOverlayClose}
      onClose={props.onClose}
      footer={footer}
      footerScrollRevealGap={props.footerScrollRevealGap}
      footerScrollRevealKeyboardOnly={props.footerScrollRevealKeyboardOnly}
    >
      <View>
        {props.sectionTitle.trim() ? (
          <Text style={[styles.sectionTitle, { color: t.text }]}>{props.sectionTitle}</Text>
        ) : null}
        {props.children}
      </View>
    </ReservationImmersiveStepShell>
  );
}
