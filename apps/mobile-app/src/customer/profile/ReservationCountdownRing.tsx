import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useAppTheme } from "../../theme/AppThemeContext";
import {
  countdownFillProgress,
  formatReservationVisitTime,
  padCountdownUnit,
  reservationVisitHeadline,
  reservationVisitPhase,
  splitCountdownRemaining
} from "./reservationCountdown";

const COUNTDOWN_TICK_MS = 1000;
const SWEEP_MS = 5000;
const PAUSE_MS = 2000;
const CYCLE_MS = SWEEP_MS + PAUSE_MS;

const RING_GREY = "rgba(148, 163, 184, 0.55)";
const RING_GREY_INNER = "rgba(148, 163, 184, 0.22)";
const RING_PURPLE = "#7C3AED";
const RING_PURPLE_DEEP = "#5B21B6";
const RING_PURPLE_BRIGHT = "#A78BFA";
const RING_PURPLE_SHIMMER = "#DDD6FE";

const PULSE_SEG_FRAC = 0.14;
const PULSE_AHEAD_FRAC = 0.24;

type Props = {
  startsAt: string;
  createdAt: string;
  size?: number;
};

function CountdownUnit({
  value,
  label,
  textColor,
  mutedColor
}: {
  value: string;
  label: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.unit}>
      <Text style={[styles.unitValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.unitLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function svgId(raw: string): string {
  return raw.replace(/:/g, "");
}

function smoothStep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function flexEase(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

type PulseState = { offset: number; opacity: number; onFill: boolean };

/**
 * Single pulse: emerges inside fill → crosses the tip → keeps moving on grey while fading.
 * Fade begins the moment the leading edge leaves the purple fill.
 */
function computePulse(
  phase: number,
  fillLen: number,
  segLen: number,
  aheadLen: number,
  circumference: number
): PulseState | null {
  if (fillLen <= 0 || phase <= 0 || phase >= 1) return null;

  const insideStart = Math.max(0, fillLen - segLen);
  const endPos = fillLen + aheadLen;
  const pos = insideStart + flexEase(phase) * (endPos - insideStart);

  let opacity: number;
  if (pos < fillLen) {
    const emerge = segLen > 0 ? (pos - insideStart) / segLen : 1;
    opacity = 0.2 + 0.8 * smoothStep(Math.min(1, emerge));
  } else {
    opacity = 1 - smoothStep(Math.min(1, (pos - fillLen) / Math.max(aheadLen, 1)));
  }

  if (opacity < 0.03) return null;

  return {
    offset: circumference - pos,
    opacity,
    onFill: pos + segLen <= fillLen + 0.5
  };
}

function pulsePhaseFromElapsed(elapsedMs: number): { phase: number; active: boolean } {
  const cyclePos = elapsedMs % CYCLE_MS;
  if (cyclePos >= SWEEP_MS) {
    return { phase: 0, active: false };
  }
  return { phase: cyclePos / SWEEP_MS, active: true };
}

export function ReservationCountdownRing({ startsAt, createdAt, size = 300 }: Props) {
  const { colors: t, isDark } = useAppTheme();
  const uid = svgId(React.useId());
  const [now, setNow] = React.useState(() => Date.now());
  const [pulsePhase, setPulsePhase] = React.useState(0);
  const [pulseActive, setPulseActive] = React.useState(true);

  const startsAtMs = new Date(startsAt).getTime();
  const windowStartMs = new Date(createdAt).getTime();

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const visitPhase = reservationVisitPhase(startsAt, now);
  const fill = countdownFillProgress(now, startsAtMs, windowStartMs);
  const fillComplete = fill >= 1 || visitPhase !== "upcoming";
  const showPulse = !fillComplete;

  React.useEffect(() => {
    if (!showPulse) {
      setPulseActive(false);
      setPulsePhase(0);
      return;
    }

    const t0 = performance.now();
    let frame = 0;
    const loop = (ts: number) => {
      const { phase, active } = pulsePhaseFromElapsed(ts - t0);
      setPulsePhase(phase);
      setPulseActive(active);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [showPulse]);

  const remainingMs = startsAtMs - now;
  const parts = splitCountdownRemaining(remainingMs);
  const visitTimeLabel = formatReservationVisitTime(startsAt);
  const headline = reservationVisitHeadline(visitPhase);

  const stroke = 16;
  const trackStroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const segLen = c * PULSE_SEG_FRAC;
  const aheadLen = c * PULSE_AHEAD_FRAC;

  const fillLen = fillComplete ? c : Math.max(0, c * fill);
  const fillDash = `${fillLen} ${Math.max(0, c - fillLen)}`;

  const pulse =
    showPulse && pulseActive ? computePulse(pulsePhase, fillLen, segLen, aheadLen, c) : null;

  const gradBase = `${uid}-base`;
  const gradShimmer = `${uid}-shimmer`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradBase} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={RING_PURPLE_DEEP} />
            <Stop offset="50%" stopColor={RING_PURPLE} />
            <Stop offset="100%" stopColor={RING_PURPLE_BRIGHT} />
          </LinearGradient>
          <LinearGradient id={gradShimmer} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="rgba(221, 214, 254, 0)" />
            <Stop offset="30%" stopColor="rgba(196, 181, 253, 0.65)" />
            <Stop offset="50%" stopColor={RING_PURPLE_SHIMMER} />
            <Stop offset="70%" stopColor="rgba(196, 181, 253, 0.65)" />
            <Stop offset="100%" stopColor="rgba(221, 214, 254, 0)" />
          </LinearGradient>
        </Defs>

        <Circle
          cx={cx}
          cy={cx}
          r={r - stroke * 0.35}
          stroke={RING_GREY_INNER}
          strokeWidth={trackStroke}
          fill={isDark ? "rgba(15,23,42,0.35)" : "rgba(248,250,252,0.85)"}
        />

        <Circle cx={cx} cy={cx} r={r} stroke={RING_GREY} strokeWidth={stroke} fill="none" />

        {fillLen > 0 ? (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={`url(#${gradBase})`}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={fillDash}
            strokeDashoffset={0}
            strokeLinecap="round"
            rotation={-90}
            origin={`${cx}, ${cx}`}
          />
        ) : null}

        {pulse ? (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={pulse.onFill ? `url(#${gradShimmer})` : `url(#${gradBase})`}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${segLen} ${c - segLen}`}
            strokeDashoffset={pulse.offset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${cx}, ${cx}`}
            opacity={pulse.opacity}
          />
        ) : null}
      </Svg>

      <View style={styles.center}>
        {visitPhase === "upcoming" ? (
          <View style={styles.unitsRow}>
            <CountdownUnit
              value={padCountdownUnit(parts.days)}
              label="days"
              textColor={t.text}
              mutedColor={t.textMuted}
            />
            <Text style={[styles.colon, { color: t.textMuted }]}>:</Text>
            <CountdownUnit
              value={padCountdownUnit(parts.hours)}
              label="hours"
              textColor={t.text}
              mutedColor={t.textMuted}
            />
            <Text style={[styles.colon, { color: t.textMuted }]}>:</Text>
            <CountdownUnit
              value={padCountdownUnit(parts.minutes)}
              label="min"
              textColor={t.text}
              mutedColor={t.textMuted}
            />
          </View>
        ) : (
          <>
            <Text style={[styles.statusHeadline, { color: t.text }]}>{headline}</Text>
            <Text style={[styles.statusTime, { color: t.textSecondary }]}>{visitTimeLabel}</Text>
          </>
        )}
        {visitPhase === "upcoming" ? (
          <Text style={[styles.sub, { color: t.textSecondary }]}>{visitTimeLabel}</Text>
        ) : null}
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
    paddingHorizontal: 20,
    maxWidth: "92%"
  },
  unitsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4
  },
  unit: {
    alignItems: "center",
    minWidth: 52
  },
  unitValue: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"]
  },
  unitLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  colon: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
    opacity: 0.45
  },
  statusHeadline: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 28
  },
  statusTime: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20
  }
});
