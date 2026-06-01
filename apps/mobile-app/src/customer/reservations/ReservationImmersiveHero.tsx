import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { ambientNativePalettes } from "@serveos/core-ambient/themes";
import { useAppTheme } from "../../theme/AppThemeContext";
import { R } from "../../theme";

const HERO_IMAGES = [
  require("../../../assets/restImg1.jpg"),
  require("../../../assets/restImg2.png"),
  require("../../../assets/restImg3.jpeg")
] as const;

const CROSSFADE_MS = 1400;
const SLIDE_MS = 9000;
const KEN_BURNS_MS = 12000;

type Props = {
  venueName: string;
  hasVenue: boolean;
  topInset: number;
  sheetTopOffset: number;
  scrollY: Animated.Value;
  /** When false, photo + title stay fixed; only the sheet card scrolls over the hero. */
  scrollLinked?: boolean;
};

export function ReservationImmersiveHero(props: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { isDark, colors: theme } = useAppTheme();
  const ambient = ambientNativePalettes.bookings;
  /** Same top tint as the scrolling sheet card — rounded lip at hero seam. */
  const sheetFill = isDark ? theme.meshTop : ambient.top;
  const heroPurple = theme.ordersNavPurpleBright;
  const heroH = Math.round(Math.min(screenH * 0.54, 440));
  const [activeIndex, setActiveIndex] = React.useState(0);
  const opacities = React.useRef(HERO_IMAGES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const scales = React.useRef(HERO_IMAGES.map(() => new Animated.Value(1))).current;
  const activeRef = React.useRef(0);
  const kenBurnsRef = React.useRef<ReturnType<typeof Animated.timing> | null>(null);

  const runKenBurns = React.useCallback((idx: number) => {
    kenBurnsRef.current?.stop();
    scales[idx].setValue(1);
    kenBurnsRef.current = Animated.timing(scales[idx], {
      toValue: 1.1,
      duration: KEN_BURNS_MS,
      useNativeDriver: true
    });
    kenBurnsRef.current.start();
  }, [scales]);

  const crossfadeTo = React.useCallback(
    (next: number) => {
      const prev = activeRef.current;
      if (prev === next) return;
      activeRef.current = next;
      setActiveIndex(next);
      runKenBurns(next);
      Animated.parallel([
        Animated.timing(opacities[prev], {
          toValue: 0,
          duration: CROSSFADE_MS,
          useNativeDriver: true
        }),
        Animated.timing(opacities[next], {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true
        })
      ]).start();
    },
    [opacities, runKenBurns]
  );

  React.useEffect(() => {
    runKenBurns(0);
    const timer = setInterval(() => {
      const next = (activeRef.current + 1) % HERO_IMAGES.length;
      crossfadeTo(next);
    }, SLIDE_MS);
    return () => {
      clearInterval(timer);
      kenBurnsRef.current?.stop();
    };
  }, [crossfadeTo, runKenBurns]);

  const displayName = props.hasVenue ? props.venueName : "Choose your venue";
  const scrollLinked = props.scrollLinked !== false;
  const navTitleTop = props.topInset + 10;

  const collapseDistance = Math.min(148, Math.max(80, Math.round(props.sheetTopOffset * 0.52)));
  const collapse = props.scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const largeOpacity = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 0.72, 1],
        outputRange: [1, 0.22, 0],
        extrapolate: "clamp"
      })
    : 1;
  const compactOpacity = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 0.28, 1],
        outputRange: [0, 0.55, 1],
        extrapolate: "clamp"
      })
    : 0;
  const eyebrowOpacity = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 0.45],
        outputRange: [1, 0],
        extrapolate: "clamp"
      })
    : 1;
  const taglineOpacity = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 0.5],
        outputRange: [1, 0],
        extrapolate: "clamp"
      })
    : 1;
  const largeTranslateY = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -18]
      })
    : 0;
  const largeScale = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.92]
      })
    : 1;
  const headlineSize = scrollLinked
    ? props.scrollY.interpolate({
        inputRange: [0, collapseDistance],
        outputRange: [34, 18],
        extrapolate: "clamp"
      })
    : 34;
  const compactScale = scrollLinked
    ? collapse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 1]
      })
    : 1;

  return (
    <View style={[styles.wrap, { width: screenW, height: heroH }]}>
      {HERO_IMAGES.map((src, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: opacities[i],
              transform: [{ scale: scales[i] }]
            }
          ]}
        >
          <Image source={src} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        </Animated.View>
      ))}

      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.02)"]}
        locations={[0, 0.45, 1]}
        style={[StyleSheet.absoluteFill, styles.topVignette]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.88)"]}
        locations={[0.35, 0.68, 1]}
        style={[StyleSheet.absoluteFill, styles.bottomVignette]}
        pointerEvents="none"
      />

      {Platform.OS === "ios" ? (
        <BlurView intensity={18} tint="dark" style={styles.bottomBlur} pointerEvents="none" />
      ) : null}

      {/* Compact nav title — fades in centered as user scrolls up. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.compactNav,
          {
            top: navTitleTop,
            opacity: compactOpacity,
            transform: [{ scale: compactScale }]
          }
        ]}
      >
        <Text style={[styles.compactTitle, { color: heroPurple }]} numberOfLines={1} ellipsizeMode="tail">
          {displayName}
        </Text>
      </Animated.View>

      {/* Large title stack — shrinks and fades as sheet scrolls over the hero. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.copy,
          {
            paddingTop: props.topInset + 12,
            paddingBottom: 28,
            opacity: largeOpacity,
            transform: [{ translateY: largeTranslateY }, { scale: largeScale }]
          }
        ]}
      >
        <Animated.Text style={[styles.eyebrow, { color: heroPurple, opacity: eyebrowOpacity }]}>
          Entering
        </Animated.Text>
        <Animated.Text
          style={[styles.headline, { color: heroPurple, fontSize: headlineSize }]}
          numberOfLines={2}
        >
          {displayName}
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { color: heroPurple, opacity: taglineOpacity }]}>
          The restaurant experience
        </Animated.Text>
      </Animated.View>

      <View style={[styles.sheetCurve, { backgroundColor: sheetFill }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    marginBottom: -20
  },
  photo: {
    width: "108%",
    height: "108%",
    marginLeft: "-4%",
    marginTop: "-4%"
  },
  topVignette: { height: "55%" },
  bottomVignette: { top: "30%" },
  bottomBlur: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    opacity: 0.45
  },
  compactNav: {
    position: "absolute",
    left: R.space.md,
    right: R.space.md,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    maxWidth: "92%"
  },
  copy: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: R.space.md,
    zIndex: 2
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8
  },
  headline: {
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38
  },
  tagline: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: "600"
  },
  sheetCurve: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 5
  }
});
