/**
 * Single-hue scrim (slate) with strictly increasing alpha — avoids the “dark band” that
 * appeared when mixing indigo mid-stops. Feather is long into the page; chrome end stays strong.
 *
 * Bottom vignette: y=0 toward page center (weak), y=1 toward home indicator (strong).
 */
export const BOTTOM_NAV_DIMMER_COLORS = [
  "rgba(15,23,42,0)",
  "rgba(15,23,42,0)",
  "rgba(15,23,42,0.12)",
  "rgba(15,23,42,0.38)",
  "rgba(15,23,42,0.64)",
  "rgba(15,23,42,0.88)",
  "rgba(15,23,42,0.97)"
] as const;

export const BOTTOM_NAV_DIMMER_LOCATIONS = [0, 0.44, 0.54, 0.66, 0.76, 0.88, 1] as const;

/** Stronger slate ramp than reversing bottom stops — top-of-screen edge stays visibly darker. */
export const TOP_NAV_DIMMER_COLORS = [
  "rgba(15,23,42,0.97)",
  "rgba(15,23,42,0.90)",
  "rgba(15,23,42,0.76)",
  "rgba(15,23,42,0.52)",
  "rgba(15,23,42,0.28)",
  "rgba(15,23,42,0.10)",
  "rgba(15,23,42,0)"
] as const;

type GradientTuple = {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
};

/** Top vignette: strong edge under status bar / top bar, long feather into scroll content. */
export function topNavDimmerGradient(): GradientTuple {
  const c = TOP_NAV_DIMMER_COLORS;
  const l = BOTTOM_NAV_DIMMER_LOCATIONS;
  const n = l.length;
  return {
    colors: [...c] as [string, string, ...string[]],
    locations: l.map((_, i) => 1 - l[n - 1 - i]!) as [number, number, ...number[]]
  };
}
