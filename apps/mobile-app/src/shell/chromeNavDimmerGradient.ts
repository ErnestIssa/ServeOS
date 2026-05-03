/**
 * Single-hue scrim (slate) with strictly increasing alpha — avoids the “dark band” that
 * appeared when mixing indigo mid-stops. Feather is long into the page; chrome end stays strong.
 *
 * Bottom vignette: y=0 toward page center (weak), y=1 toward home indicator (strong).
 */
export const BOTTOM_NAV_DIMMER_COLORS = [
  "rgba(15,23,42,0)",
  "rgba(15,23,42,0)",
  "rgba(15,23,42,0.045)",
  "rgba(15,23,42,0.18)",
  "rgba(15,23,42,0.42)",
  "rgba(15,23,42,0.68)",
  "rgba(15,23,42,0.9)"
] as const;

export const BOTTOM_NAV_DIMMER_LOCATIONS = [0, 0.44, 0.54, 0.66, 0.76, 0.88, 1] as const;

type GradientTuple = {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
};

/** Top vignette: same ramp flipped so the strong edge sits under status bar / top bar. */
export function topNavDimmerGradient(): GradientTuple {
  const c = BOTTOM_NAV_DIMMER_COLORS;
  const l = BOTTOM_NAV_DIMMER_LOCATIONS;
  const n = c.length;
  return {
    colors: [...c].reverse() as [string, string, ...string[]],
    locations: l.map((_, i) => 1 - l[n - 1 - i]!) as [number, number, ...number[]]
  };
}
