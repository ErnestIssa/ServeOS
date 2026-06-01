import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "../../theme/AppThemeContext";
import { countdownProgress, formatCountdownRemaining } from "./reservationCountdown";

type Props = {
  startsAt: string;
  /** When the countdown window began (usually createdAt). */
  windowStartAt?: string;
  size?: number;
};

const TICK_MS = 1000;

export function ReservationCountdownRing({ startsAt, windowStartAt, size = 280 }: Props) {
  const { colors: t } = useAppTheme();
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(startsAt).getTime();
  const windowStartMs = windowStartAt ? new Date(windowStartAt).getTime() : startMs - 24 * 60 * 60 * 1000;
  const totalMs = Math.max(startMs - windowStartMs, 60_000);
  const remainingMs = startMs - now;
  const progress = countdownProgress(remainingMs, totalMs);

  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);

  const label = formatCountdownRemaining(remainingMs);
  const sub =
    remainingMs <= 0
      ? "Your table is ready"
      : new Date(startsAt).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`${t.ordersNavPurpleBright}33`}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.ordersNavPurpleBright}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.label, { color: t.text }]}>{label}</Text>
        <Text style={[styles.sub, { color: t.textSecondary }]}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  label: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center"
  },
  sub: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20
  }
});
