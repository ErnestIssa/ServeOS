import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { R } from "../theme";
import { NavIconOrdersMark } from "../shell/NavTabIcons";
import { noMenuAtVenueMessage } from "./venueContentHelpers";
import { getRestaurantPrefsForCustomer, type RestaurantPrefs } from "../menu/menuPreferencesStorage";

/**
 * Same hue order as login `swapColor`, tuned for light backgrounds (no phrase panel / no border).
 */
function swapColorOnLight(i: number): string {
  return i % 4 === 0
    ? "#4C1D95"
    : i % 4 === 1
      ? "#B45309"
      : i % 4 === 2
        ? "#047857"
        : "#0369A1";
}

const PREFERRED_EXPERIENCE_KEY = "serveos.device.preferredExperience";
const ORDERS_IDLE_LAST_SEEN_KEY = "serveos.customer.orders_idle_last_seen_at_iso";

export type EmptyOrdersPhraseEntry = {
  text: string;
  icon?: "orders";
};

function usePhraseAdvanceOnLand(
  phrases: readonly EmptyOrdersPhraseEntry[],
  landTick: number,
  opacity: Animated.Value,
  x: Animated.Value,
  phraseKey: string,
  landTickRef: React.MutableRefObject<number>,
  paused: boolean
) {
  const [idx, setIdx] = React.useState(0);
  const [colorTick, setColorTick] = React.useState(0);
  const lastColorByPhrase = React.useRef<Record<string, number>>({}).current;
  const lastGlobalColor = React.useRef<number | null>(null);
  const prevLandTick = React.useRef(0);

  React.useEffect(() => {
    setIdx(0);
    setColorTick(0);
    prevLandTick.current = landTickRef.current;
    opacity.setValue(1);
    x.setValue(0);
  }, [phraseKey, opacity, x, landTickRef]);

  React.useEffect(() => {
    if (paused) return;
    if (phrases.length <= 1) return;
    if (landTick <= 0) return;
    if (landTick === prevLandTick.current) return;
    prevLandTick.current = landTick;

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(x, { toValue: -22, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]).start(() => {
      setIdx((i) => (i + 1) % phrases.length);
      setColorTick((c) => c + 1);
      x.setValue(22);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ]).start();
    });
  }, [landTick, phrases.length, opacity, x, paused]);

  const entry = phrases[Math.max(0, Math.min(idx, phrases.length - 1))] ?? { text: "" };
  const text = entry.text;
  const icon = entry.icon;
  const prev = lastColorByPhrase[text];
  const gPrev = lastGlobalColor.current;
  const candidates = [0, 1, 2, 3].filter((c) => c !== prev && c !== gPrev);
  const next =
    candidates.length > 0
      ? candidates[colorTick % candidates.length]
      : ((gPrev ?? 0) + 1) % 4;
  lastColorByPhrase[text] = next;
  lastGlobalColor.current = next;

  return { text, icon, opacity, x, colorIndex: next };
}

function cravingLine(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Hungry this morning?";
  if (h >= 12 && h < 17) return "Hungry this afternoon?";
  return "Hungry tonight?";
}

function mealIdeaLine(d: Date, brunchWeekend: boolean): string {
  const day = d.getDay();
  const h = d.getHours();
  const weekend = day === 0 || day === 6;
  if (h >= 5 && h < 11) return "Breakfast sounds great";
  if (weekend && brunchWeekend && h >= 10 && h < 14) return "Brunch sounds great";
  if (h >= 11 && h < 15) return "Lunch sounds great";
  if (h >= 15 && h < 17) return "Something warm sounds great";
  if (h >= 17 && h < 22) return "Dinner sounds great";
  return "A late bite sounds great";
}

function venueReadyLine(name: string): string {
  const vn = name.trim();
  if (!vn || vn === "No venue yet" || vn === "Your venue") return "";
  if (vn.length <= 16) return `${vn} is ready`;
  return "Your venue is ready";
}

function buildPhraseEntries(args: {
  now: Date;
  venueName: string;
  businessTone: boolean;
  ordersSessionVisits: number;
  returningLongGap: boolean;
}): EmptyOrdersPhraseEntry[] {
  const { now, venueName, businessTone, ordersSessionVisits, returningLongGap } = args;
  const venueLine = venueReadyLine(venueName);
  const meal = mealIdeaLine(now, true);

  const out: EmptyOrdersPhraseEntry[] = [];

  if (ordersSessionVisits >= 2) {
    out.push({ text: businessTone ? "Menu's ready when you are" : "Back again? Great timing" });
  }

  out.push({ text: businessTone ? "Ready to order?" : "Hungry already?" });
  out.push({ text: "Something tasty awaits", icon: "orders" });
  out.push({ text: "One tap to your next meal" });
  out.push({ text: "Fresh food in minutes" });
  out.push({ text: cravingLine(now) });
  if (venueLine) {
    out.push({ text: venueLine });
  }
  out.push({ text: businessTone ? "See what's on the pass" : "See what's cooking" });
  out.push({ text: meal });

  if (returningLongGap) {
    out.push({ text: businessTone ? "Welcome back" : "Good to see you again" });
  }

  const seed =
    (now.getHours() * 13 + venueName.length * 3 + (venueLine ? 7 : 0) + ordersSessionVisits * 5) % out.length;
  if (seed > 0) {
    return [...out.slice(seed), ...out.slice(0, seed)];
  }
  return out;
}

function menuEngaged(p: RestaurantPrefs): boolean {
  return (
    p.likes.length > 0 ||
    p.lastOrdered.length > 0 ||
    (p.browseEngagementScore ?? 0) > 0
  );
}

function primaryCtaLabel(args: {
  cartCount: number;
  engaged: boolean;
  ordersSessionVisits: number;
}): string {
  const { cartCount, engaged, ordersSessionVisits } = args;
  if (cartCount > 0) {
    return engaged ? "Continue ordering" : "Start ordering";
  }
  if (engaged) {
    const explore =
      ordersSessionVisits <= 1
        ? Math.floor(Date.now() / 86400000) % 2 === 0
        : ordersSessionVisits % 2 === 1;
    return explore ? "Continue exploring" : "Continue browsing";
  }
  const explore = Math.floor(Date.now() / 86400000) % 2 === 0;
  return explore ? "Explore food" : "Browse menu";
}

type Props = {
  restaurantId: string;
  venueName: string;
  cartItemCount: number;
  menuPrefsVersion: number;
  ordersSessionVisits: number;
  /** Increments exactly when the empty-cart animation’s last bounce lands. */
  phraseLandTick: number;
  /** Pauses phrase transitions (e.g. while search sheet is open on Orders). */
  motionPaused?: boolean;
  /** Venue is selected but has no customer-facing menu items. */
  noBrowsableMenu?: boolean;
  onPrimaryCta: () => void;
  onSwitchVenue?: () => void;
  authToken?: string | null;
};

export function EmptyOrdersCtaSection({
  restaurantId,
  venueName,
  cartItemCount,
  menuPrefsVersion,
  ordersSessionVisits,
  phraseLandTick,
  motionPaused = false,
  noBrowsableMenu = false,
  onPrimaryCta,
  onSwitchVenue,
  authToken
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const [businessTone, setBusinessTone] = React.useState(false);
  const [prefs, setPrefs] = React.useState<RestaurantPrefs | null>(null);
  const [clock, setClock] = React.useState(() => new Date());
  const [returningLongGap, setReturningLongGap] = React.useState(false);

  const phraseOpacity = React.useRef(new Animated.Value(1)).current;
  const phraseX = React.useRef(new Animated.Value(0)).current;
  const phraseLandTickRef = React.useRef(phraseLandTick);
  phraseLandTickRef.current = phraseLandTick;

  React.useEffect(() => {
    if (!motionPaused) return;
    phraseOpacity.stopAnimation();
    phraseX.stopAnimation();
    phraseOpacity.setValue(1);
    phraseX.setValue(0);
  }, [motionPaused, phraseOpacity, phraseX]);

  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pref = await AsyncStorage.getItem(PREFERRED_EXPERIENCE_KEY);
        if (!cancelled && pref === "BUSINESS") setBusinessTone(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(ORDERS_IDLE_LAST_SEEN_KEY);
        const prev = raw ? Date.parse(raw) : NaN;
        if (!Number.isFinite(prev)) {
          if (!cancelled) setReturningLongGap(false);
          return;
        }
        const gapMs = Date.now() - prev;
        if (!cancelled) setReturningLongGap(gapMs > 36 * 60 * 60 * 1000);
      } catch {
        if (!cancelled) setReturningLongGap(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  React.useEffect(() => {
    return () => {
      void AsyncStorage.setItem(ORDERS_IDLE_LAST_SEEN_KEY, new Date().toISOString());
    };
  }, [restaurantId]);

  React.useEffect(() => {
    const rid = restaurantId.trim();
    if (!rid) {
      setPrefs(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const p = await getRestaurantPrefsForCustomer(rid, authToken);
      if (!cancelled) setPrefs(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, menuPrefsVersion, authToken]);

  const hourBucket = clock.getHours();
  const dayBucket = clock.getDay();
  const phrases = React.useMemo(
    () =>
      buildPhraseEntries({
        now: clock,
        venueName,
        businessTone,
        ordersSessionVisits,
        returningLongGap
      }),
    [hourBucket, dayBucket, venueName, businessTone, ordersSessionVisits, returningLongGap]
  );

  const phraseKey = React.useMemo(() => phrases.map((p) => p.text).join("|"), [phrases]);

  const swap = usePhraseAdvanceOnLand(
    phrases,
    phraseLandTick,
    phraseOpacity,
    phraseX,
    phraseKey,
    phraseLandTickRef,
    motionPaused
  );
  const engaged = prefs ? menuEngaged(prefs) : false;
  const ctaLabel = noBrowsableMenu
    ? "Switch venue"
    : primaryCtaLabel({
        cartCount: cartItemCount,
        engaged,
        ordersSessionVisits
      });
  const ctaAction = noBrowsableMenu ? (onSwitchVenue ?? onPrimaryCta) : onPrimaryCta;
  const staticNoMenuPhrase = noMenuAtVenueMessage(venueName);

  const stripMaxW = Math.min(520, screenW - 32);
  const fg = noBrowsableMenu ? R.textSecondary : swapColorOnLight(swap.colorIndex);

  return (
    <View style={styles.root}>
      <View style={[styles.phraseStrip, { maxWidth: stripMaxW }]}>
        {noBrowsableMenu ? (
          <Text style={[styles.phraseBig, styles.phraseStatic, { color: fg }]} numberOfLines={3}>
            {staticNoMenuPhrase}
          </Text>
        ) : (
          <Animated.View
            style={[styles.phraseRow, { opacity: swap.opacity, transform: [{ translateX: swap.x }] }]}
          >
            <Animated.Text
              style={[styles.phraseBig, { color: fg }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {swap.text}
            </Animated.Text>
            {swap.icon === "orders" ? (
              <View style={styles.iconPad}>
                <NavIconOrdersMark size={22} color={fg} />
              </View>
            ) : null}
          </Animated.View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          ctaAction();
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  phraseStrip: {
    width: "100%",
    alignSelf: "center",
    overflow: "hidden"
  },
  phraseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    width: "100%",
    gap: 8
  },
  /** Matches `AuthFlowScreen` `phraseBig` weight; single line on light surface. */
  phraseBig: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.2,
    textAlign: "center"
  },
  phraseStatic: { width: "100%" },
  iconPad: { flexShrink: 0, paddingTop: 1 },
  cta: {
    marginTop: 22,
    minWidth: 228,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: R.radius.pill,
    backgroundColor: R.accentPurple,
    alignItems: "center",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: {
    color: "#FFFFFF",
    fontSize: R.type.body,
    fontWeight: "800",
    letterSpacing: 0.2
  }
});
