import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { buildBookRecapParts } from "./reservationBookRecap";
import { ADDON_OPTIONS, BOOK_AGAIN_CARD_OPTION, CONFIRMATION_EXTRA_CARD_OPTIONS } from "./reservationPresets";
import { RESERVATION_BOOK_STEP_NUMBER } from "./reservationBookSteps";
import { ReservationBookSection, ReservationBookStepShell } from "./ReservationBookStepShell";
import { ReservationChoiceCardGrid } from "./ReservationChoiceCardGrid";
import { ReservationPrimaryButton } from "./ReservationUi";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { useAppTheme } from "../../theme/AppThemeContext";
import type { ReservationDraft, ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext &
  ReservationImmersiveShellProps & {
    draft: ReservationDraft;
    confirmationCode: string;
    addonIds: string[];
    onToggleAddon: (id: string) => void;
    onManage: () => void;
    onOpenChat: () => void;
    onDone: () => void;
    onBookAgain: () => void;
    doneLoading?: boolean;
    hasVenue: boolean;
  };

export function ReservationConfirmationScreen(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const { draft, confirmationCode } = props;
  const recapLine = React.useMemo(() => buildBookRecapParts(draft, 3).join(" · "), [draft]);

  return (
    <ReservationBookStepShell
      {...immersiveShellPassThrough(props)}
      bookStep={RESERVATION_BOOK_STEP_NUMBER.confirmation}
      draft={draft}
      onDraftChange={() => {}}
      hasVenue={props.hasVenue}
      sectionTitle="You're booked"
      footerLabel="Done"
      footerLoading={props.doneLoading}
      onFooterPress={props.onDone}
      footer={
        <ReservationPrimaryButton
          variant="purple"
          label="Done"
          loading={props.doneLoading}
          onPress={props.onDone}
        />
      }
    >
      <View
        style={[
          styles.successCard,
          {
            borderColor: t.ordersNavPurpleBright,
            backgroundColor: isDark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.94)"
          }
        ]}
      >
        <Text style={[styles.successEmoji, { color: t.success }]}>✓</Text>
        <Text style={[styles.code, { color: t.text }]}>{confirmationCode}</Text>
        <Text style={[styles.summary, { color: t.textSecondary }]}>
          {props.restaurantName}
          {recapLine ? ` · ${recapLine}` : null}
        </Text>
      </View>

      <ReservationBookSection title="While you wait" first>
        <ReservationChoiceCardGrid
          options={CONFIRMATION_EXTRA_CARD_OPTIONS}
          isDark={isDark}
          t={t}
          selectedId={() => false}
          onToggle={() => {}}
        />
      </ReservationBookSection>

      <ReservationBookSection title="Add-ons">
        <ReservationChoiceCardGrid
          options={ADDON_OPTIONS}
          isDark={isDark}
          t={t}
          selectedId={(id) => props.addonIds.includes(id)}
          onToggle={props.onToggleAddon}
        />
      </ReservationBookSection>

      <ReservationBookSection title="More">
        <ReservationChoiceCardGrid
          options={[
            { id: "manage", label: "Manage booking", sublabel: "Change or cancel" },
            { id: "chat", label: "Message the restaurant", sublabel: "Open chat" }
          ]}
          isDark={isDark}
          t={t}
          selectedId={() => false}
          onToggle={(id) => {
            if (id === "manage") props.onManage();
            if (id === "chat") props.onOpenChat();
          }}
        />
      </ReservationBookSection>

      <ReservationBookSection title="Another visit">
        <ReservationChoiceCardGrid
          options={[BOOK_AGAIN_CARD_OPTION]}
          isDark={isDark}
          t={t}
          selectedId={() => false}
          onToggle={(id) => {
            if (id === BOOK_AGAIN_CARD_OPTION.id) props.onBookAgain();
          }}
        />
      </ReservationBookSection>
    </ReservationBookStepShell>
  );
}

const styles = StyleSheet.create({
  successCard: {
    borderRadius: 20,
    borderWidth: 2,
    minHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  successEmoji: { fontSize: 36, fontWeight: "800" },
  code: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 6
  },
  summary: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18
  },
  table: { marginTop: 6, fontSize: 15, fontWeight: "800" }
});
