import React from "react";
import { Animated, ScrollView, View, useWindowDimensions } from "react-native";

function readAnimatedScrollY(scrollY: Animated.Value): number {
  const v = scrollY as Animated.Value & { __getValue?: () => number };
  return typeof v.__getValue === "function" ? Math.max(0, v.__getValue()) : 0;
}
import { ambientNativePalettes } from "@serveos/core-ambient/themes";
import { ReservationImmersiveHero } from "./ReservationImmersiveHero";
import { ReservationScreenShell } from "./ReservationScreenShell";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  restaurantName: string;
  hasVenue: boolean;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onBack?: () => void;
  restoreScrollY?: number;
  scrollRestoreToken?: number;
  presentationActive?: boolean;
  enterScrollToken?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/** Post-landing booking steps — same fixed hero + gradient sheet as the Book landing screen. */
export function ReservationImmersiveStepShell(props: Props) {
  const { height: screenH } = useWindowDimensions();
  const { colors: t, isDark } = useAppTheme();
  const heroH = Math.round(Math.min(screenH * 0.54, 440));
  const sheetTopOffset = heroH - 20;
  const ambient = ambientNativePalettes.bookings;
  const sheetGradient: [string, string] = isDark ? [t.meshTop, t.meshBottom] : [ambient.top, ambient.bottom];
  const scrollRef = React.useRef<ScrollView | null>(null);
  const lastEnterScrollTokenRef = React.useRef(0);

  /** Match landing “Reserve” scroll position when Build your visit opens. */
  React.useEffect(() => {
    if (!props.presentationActive) return;
    const y = readAnimatedScrollY(props.scrollY);
    const animateEnter =
      props.enterScrollToken != null &&
      props.enterScrollToken !== lastEnterScrollTokenRef.current &&
      y > 8;
    if (props.enterScrollToken != null) {
      lastEnterScrollTokenRef.current = props.enterScrollToken;
    }
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: animateEnter });
    });
    return () => cancelAnimationFrame(id);
  }, [props.presentationActive, props.enterScrollToken]);

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
          onBack={props.onBack}
          cardOverlayBack={Boolean(props.onBack)}
          footer={props.footer}
        >
          {props.children}
        </ReservationScreenShell>
      </View>
    </View>
  );
}
