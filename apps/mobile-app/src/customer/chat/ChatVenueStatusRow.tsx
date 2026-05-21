import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { CustomerChatVenueStatus } from "../customerChatApi";
import { computeVenueHoursState, isVenueOpenNow, useVenueClockTick } from "../venueOpenNow";

const GREEN = "#047857";
const YELLOW = "#ca8a04";
const GREY = "#9ca3af";
const RED = "#dc2626";
const CLOSING = "#b45309";

/** Two soft opacity dips per 3s (lazy partial blink). */
function useLazyPartialBlink(active: boolean): Animated.Value {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return;
    }
    const dip = (to: number, ms: number) =>
      Animated.timing(opacity, { toValue: to, duration: ms, useNativeDriver: true });
    const oneBlink = Animated.sequence([dip(0.42, 320), dip(1, 320)]);
    const loop = Animated.loop(
      Animated.sequence([oneBlink, oneBlink, Animated.delay(1640)])
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity]);

  return opacity;
}

type Props = {
  openingHours: string | null | undefined;
  venueStatus?: CustomerChatVenueStatus | null;
};

export function ChatVenueStatusRow({ openingHours, venueStatus }: Props) {
  const now = useVenueClockTick(30000);
  const hoursState = computeVenueHoursState(openingHours, now);
  const withinHours = isVenueOpenNow(openingHours, now);
  const restaurantOnline = venueStatus?.restaurantOnline ?? false;

  const presenceLabel = restaurantOnline ? "Online" : "Offline";
  const presenceColor = restaurantOnline ? GREEN : withinHours ? YELLOW : GREY;

  const hoursBlink = useLazyPartialBlink(hoursState === "open" || hoursState === "closing_soon");

  let hoursLabel = "Closed";
  let hoursColor = RED;
  let hoursBlinkOn = false;
  if (hoursState === "open") {
    hoursLabel = "Open";
    hoursColor = GREEN;
    hoursBlinkOn = true;
  } else if (hoursState === "closing_soon") {
    hoursLabel = "Closing soon";
    hoursColor = CLOSING;
    hoursBlinkOn = true;
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.small, { color: presenceColor }]}>{presenceLabel}</Text>
      {hoursBlinkOn ? (
        <Animated.Text style={[styles.small, styles.right, { color: hoursColor, opacity: hoursBlink }]}>
          {hoursLabel}
        </Animated.Text>
      ) : (
        <Text style={[styles.small, styles.right, { color: hoursColor }]}>{hoursLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2
  },
  small: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  right: { textAlign: "right" }
});
