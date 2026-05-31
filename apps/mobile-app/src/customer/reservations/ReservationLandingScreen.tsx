import React from "react";
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ambientNativePalettes } from "@serveos/core-ambient/themes";
import { buildQuickDateOptions, quickDateIdFromLabel } from "./reservationQuickDates";
import { BRANCH_OPTIONS, RECOMMENDATION_PICKS } from "./reservationPresets";
import { ReservationChoiceCardGrid } from "./ReservationChoiceCardGrid";
import { ReservationImmersiveHero } from "./ReservationImmersiveHero";
import { ReservationPlanVisitIntro } from "./ReservationPlanVisitIntro";
import { ReservationQuickBookingBar } from "./ReservationQuickBookingBar";
import { ReservationPrimaryButton } from "./ReservationUi";
import { ReservationScreenShell } from "./ReservationScreenShell";
import { useAppTheme } from "../../theme/AppThemeContext";
import type { ReservationDraft, ReservationFlowContext } from "./reservationTypes";

type AvailabilityState = "available" | "limited" | "not_available";

function computeAvailability(draft: ReservationDraft): AvailabilityState {
  const guests = Math.max(1, Number.isFinite(draft.guests) ? draft.guests : 1);
  const time = String(draft.timeLabel || "");
  const date = String(draft.dateLabel || "");

  if (guests >= 8 && (time === "21:00" || /next week/i.test(date))) return "not_available";
  if (guests >= 6) return "limited";
  if (time === "19:00" || time === "21:00") return "limited";
  return "available";
}

type Props = ReservationFlowContext & {
  hasVenue: boolean;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof import("react-native").Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  draft: ReservationDraft;
  onDraftChange: (patch: Partial<ReservationDraft>) => void;
  onStartBooking: () => void;
  startBookingLoading?: boolean;
  onManageBookings: () => void;
  onGroupEvent: () => void;
  onChooseVenue: () => void;
  restoreScrollY?: number;
  scrollRestoreToken?: number;
};

export function ReservationLandingScreen(props: Props) {
  const { height: screenH } = useWindowDimensions();
  const { colors: t, isDark } = useAppTheme();
  const heroH = Math.round(Math.min(screenH * 0.54, 440));
  const sheetTopOffset = heroH - 20;

  const ambient = ambientNativePalettes.bookings;
  const sheetGradient: [string, string] = isDark ? [t.meshTop, t.meshBottom] : [ambient.top, ambient.bottom];

  const scrollRef = React.useRef<ScrollView | null>(null);
  const quickDateOptions = React.useMemo(() => buildQuickDateOptions(10), []);
  const [experienceSectionY, setExperienceSectionY] = React.useState<number | null>(null);
  const pendingExperienceScrollRef = React.useRef(false);
  const [quickBarScrollLock, setQuickBarScrollLock] = React.useState(false);

  React.useEffect(() => {
    if (!quickBarScrollLock) return;
    const id = setTimeout(() => setQuickBarScrollLock(false), 1200);
    return () => clearTimeout(id);
  }, [quickBarScrollLock]);

  /** Matches `ReservationScreenShell` immersiveBody.paddingTop. */
  const IMMERSIVE_BODY_TOP_PAD = 4;

  const experienceScrollY = React.useCallback(
    (sectionY: number) =>
      Math.max(0, sheetTopOffset + IMMERSIVE_BODY_TOP_PAD + sectionY - props.scrollTopPad),
    [props.scrollTopPad, sheetTopOffset]
  );

  const scrollToExperienceSection = React.useCallback(() => {
    if (experienceSectionY == null) {
      pendingExperienceScrollRef.current = true;
      return;
    }
    scrollRef.current?.scrollTo({ y: experienceScrollY(experienceSectionY), animated: true });
  }, [experienceSectionY, experienceScrollY]);

  React.useEffect(() => {
    if (!pendingExperienceScrollRef.current || experienceSectionY == null) return;
    pendingExperienceScrollRef.current = false;
    scrollRef.current?.scrollTo({ y: experienceScrollY(experienceSectionY), animated: true });
  }, [experienceSectionY, experienceScrollY]);

  const availability = React.useMemo(() => computeAvailability(props.draft), [props.draft]);
  const availabilityText =
    availability === "available" ? "Available" : availability === "limited" ? "Limited" : "Not Available";
  const availabilityColor =
    availability === "available" ? t.success : availability === "limited" ? "#F59E0B" : t.danger;

  const toggleBranch = React.useCallback(
    (id: string) => {
      props.onDraftChange({
        branchId: props.draft.branchId === id ? null : id
      });
    },
    [props.draft.branchId, props.onDraftChange]
  );

  const toggleQuickPick = React.useCallback(
    (id: string) => {
      const cur = props.draft.quickPickIds;
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      props.onDraftChange({ quickPickIds: next });
    },
    [props.draft.quickPickIds, props.onDraftChange]
  );

  const onDateChange = React.useCallback(
    (dateLabel: string) => {
      const quickDateId = quickDateIdFromLabel(quickDateOptions, dateLabel);
      props.onDraftChange({ dateLabel, quickDateId });
    },
    [quickDateOptions, props.onDraftChange]
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 0 }} pointerEvents="none">
        <ReservationImmersiveHero
          venueName={props.restaurantName}
          hasVenue={props.hasVenue}
          topInset={props.scrollTopPad}
          sheetTopOffset={sheetTopOffset}
          scrollY={props.scrollY}
        />
      </View>

      <View style={{ flex: 1, zIndex: 2 }}>
        <ReservationScreenShell
          layout="immersive"
          showUxTagline={false}
          onScroll={props.onScroll}
          scrollTopPad={props.scrollTopPad}
          scrollBottom={props.scrollBottom}
          sheetTopOffset={sheetTopOffset}
          sheetGradient={sheetGradient}
          scrollRefExternal={scrollRef}
          restoreScrollY={props.restoreScrollY}
          scrollRestoreToken={props.scrollRestoreToken}
          sheetScrollEnabled={!quickBarScrollLock}
          footer={
            <ReservationPrimaryButton
              variant="purple"
              label={props.hasVenue ? "Reserve a table" : "Choose venue"}
              loading={props.hasVenue ? props.startBookingLoading : false}
              onPress={() => {
                if (!props.hasVenue) {
                  props.onChooseVenue();
                  return;
                }
                scrollToExperienceSection();
                props.onStartBooking();
              }}
              disabled={!props.hasVenue}
            />
          }
        >
          <ReservationPlanVisitIntro />

          <ReservationQuickBookingBar
            guests={props.draft.guests}
            dateLabel={props.draft.dateLabel}
            timeLabel={props.draft.timeLabel}
            disabled={!props.hasVenue}
            onGuestsChange={(guests) => props.onDraftChange({ guests: Math.max(1, guests) })}
            onDateChange={onDateChange}
            onTimeChange={(timeLabel) => props.onDraftChange({ timeLabel })}
            onReserve={() => {
              if (!props.hasVenue) {
                props.onChooseVenue();
                return;
              }
              scrollToExperienceSection();
            }}
            onWheelDragActiveChange={setQuickBarScrollLock}
          />

          <Text style={{ marginTop: 2, marginBottom: 8, fontSize: 12, fontWeight: "800", color: availabilityColor }}>
            {availabilityText}
          </Text>

          <View
            onLayout={(e) => {
              setExperienceSectionY(e.nativeEvent.layout.y);
            }}
          >
            <Text style={[styles.sectionTitle, { color: t.text }]}>Choose Your Experience</Text>
            <Text style={[styles.sectionSubtitle, { color: t.ordersNavPurpleBright }]}>Branch</Text>
            <ReservationChoiceCardGrid
              options={BRANCH_OPTIONS}
              isDark={isDark}
              t={t}
              selectedId={(id) => props.draft.branchId === id}
              onToggle={toggleBranch}
            />

            <Text style={[styles.sectionSubtitle, styles.sectionSubtitleFollow, { color: t.ordersNavPurpleBright }]}>
              Quick picks
            </Text>
            <ReservationChoiceCardGrid
              options={RECOMMENDATION_PICKS}
              isDark={isDark}
              t={t}
              selectedId={(id) => props.draft.quickPickIds.includes(id)}
              onToggle={toggleQuickPick}
            />
          </View>
        </ReservationScreenShell>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 10,
    marginBottom: 6
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    marginBottom: 12
  },
  sectionSubtitleFollow: {
    marginTop: 20
  }
});
