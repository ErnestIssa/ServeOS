import React from "react";
import { Animated, ScrollView, View, useWindowDimensions } from "react-native";
import { ambientNativePalettes } from "@serveos/core-ambient/themes";
import { ReservationImmersiveHero } from "./ReservationImmersiveHero";
import { ReservationScreenShell } from "./ReservationScreenShell";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ReservationBookStepChrome } from "./ReservationBookStepChrome";
import { immersiveSheetTopOffset } from "./reservationImmersiveMetrics";

function readAnimatedScrollY(scrollY: Animated.Value): number {
  const v = scrollY as Animated.Value & { __getValue?: () => number };
  return typeof v.__getValue === "function" ? Math.max(0, v.__getValue()) : 0;
}

type Props = {
  restaurantName: string;
  hasVenue: boolean;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  onScrollEndDrag?: () => void;
  onMomentumScrollEnd?: () => void;
  scrollTopPad: number;
  scrollBottom: number;
  onBack?: () => void;
  restoreScrollY?: number;
  scrollRestoreToken?: number;
  presentationActive?: boolean;
  enterScrollToken?: number;
  /** When set with `enterScrollToken`, native scroll animates to this offset (Reserve → builder). */
  enterScrollTargetY?: number;
  sheetScrollEnabled?: boolean;
  /** When false, matches step 1 (no pill on card corner). */
  cardOverlayBack?: boolean;
  cardOverlayClose?: boolean;
  onClose?: () => void;
  scrollRefExternal?: React.RefObject<ScrollView | null>;
  /** 2+ shows centred “N of total” (step 1 / landing has no indicator). */
  bookStep?: number;
  /** When false, hero is rendered once at flow root (stays still across steps). */
  embedHero?: boolean;
  footer?: React.ReactNode;
  footerScrollRevealGap?: number;
  footerScrollRevealKeyboardOnly?: boolean;
  children: React.ReactNode;
};

/** Post-landing booking steps — same fixed hero + gradient sheet as the Book landing screen. */
export function ReservationImmersiveStepShell(props: Props) {
  const { height: screenH } = useWindowDimensions();
  const { colors: t } = useAppTheme();
  const sheetTopOffset = immersiveSheetTopOffset(screenH);
  const ambient = ambientNativePalettes.bookings;
  const sheetGradient: [string, string] = [ambient.top, ambient.bottom];
  const internalScrollRef = React.useRef<ScrollView | null>(null);
  const scrollRef = props.scrollRefExternal ?? internalScrollRef;
  const lastEnterScrollTokenRef = React.useRef(0);

  React.useLayoutEffect(() => {
    if (!props.presentationActive) return;
    const raisedEnter =
      props.enterScrollToken != null &&
      props.enterScrollToken !== lastEnterScrollTokenRef.current &&
      props.enterScrollTargetY != null;
    if (props.enterScrollToken != null) {
      lastEnterScrollTokenRef.current = props.enterScrollToken;
    }
    const y = raisedEnter ? props.enterScrollTargetY! : readAnimatedScrollY(props.scrollY);
    scrollRef.current?.scrollTo({ y, animated: raisedEnter });
  }, [props.presentationActive, props.enterScrollToken, props.enterScrollTargetY, props.scrollY, scrollRef]);

  const embedHero = props.embedHero !== false;

  return (
    <View style={{ flex: 1 }}>
      {embedHero ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 0 }} pointerEvents="none">
          <ReservationImmersiveHero
            venueName={props.restaurantName}
            hasVenue={props.hasVenue}
            topInset={props.scrollTopPad}
            sheetTopOffset={sheetTopOffset}
            scrollY={props.scrollY}
          />
        </View>
      ) : null}

      <View style={{ flex: 1, zIndex: 2 }}>
        <ReservationScreenShell
          layout="immersive"
          showUxTagline={false}
          onScroll={props.onScroll}
          onScrollEndDrag={props.onScrollEndDrag}
          onMomentumScrollEnd={props.onMomentumScrollEnd}
          scrollTopPad={props.scrollTopPad}
          scrollBottom={props.scrollBottom}
          sheetTopOffset={sheetTopOffset}
          sheetGradient={sheetGradient}
          scrollRefExternal={scrollRef}
          restoreScrollY={props.restoreScrollY}
          scrollRestoreToken={props.scrollRestoreToken}
          sheetScrollEnabled={props.sheetScrollEnabled}
          onBack={props.onBack}
          cardOverlayBack={props.cardOverlayBack === true}
          cardOverlayClose={props.cardOverlayClose === true}
          onClose={props.onClose}
          footer={props.footer}
          footerScrollRevealGap={props.footerScrollRevealGap}
          footerScrollRevealKeyboardOnly={props.footerScrollRevealKeyboardOnly}
        >
          {props.bookStep != null && props.bookStep >= 2 ? (
            <ReservationBookStepChrome step={props.bookStep} onBack={props.onBack} />
          ) : null}
          {props.children}
        </ReservationScreenShell>
      </View>
    </View>
  );
}
