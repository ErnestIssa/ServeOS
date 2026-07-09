import * as Haptics from "expo-haptics";

/** Use only for explicit confirmations (Save, Log out, destructive OK, submit). */
export function hapticConfirm() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** @deprecated Navigation and toggles should stay silent — use {@link hapticConfirm} for confirms only. */
export function hapticSelect() {
  /* intentionally silent */
}
