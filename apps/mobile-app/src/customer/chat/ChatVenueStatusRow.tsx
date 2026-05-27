import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { R } from "../../theme";
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
  onInfoPress?: () => void;
};

function HoursStatusText({
  label,
  color,
  blink
}: {
  label: string;
  color: string;
  blink: Animated.Value | null;
}) {
  if (blink) {
    return (
      <Animated.Text style={[styles.small, { color, opacity: blink }]} numberOfLines={1}>
        {label}
      </Animated.Text>
    );
  }
  return (
    <Text style={[styles.small, { color }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export function ChatVenueStatusRow({ openingHours, venueStatus, onInfoPress }: Props) {
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
      <View style={styles.hoursCluster}>
        <HoursStatusText
          label={hoursLabel}
          color={hoursColor}
          blink={hoursBlinkOn ? hoursBlink : null}
        />
        {onInfoPress ? (
          <Pressable
            style={({ pressed }) => [styles.infoBtn, pressed && styles.infoBtnPressed]}
            onPress={onInfoPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Restaurant help and menu"
          >
            <Text style={styles.infoGlyph}>i</Text>
          </Pressable>
        ) : null}
      </View>
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
  hoursCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "58%"
  },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: R.accentPurple,
    borderWidth: 1.5,
    borderColor: "#5B21B6",
    alignItems: "center",
    justifyContent: "center"
  },
  infoBtnPressed: { opacity: 0.88 },
  infoGlyph: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
    fontStyle: "italic",
    lineHeight: 13,
    marginTop: -1
  }
});
