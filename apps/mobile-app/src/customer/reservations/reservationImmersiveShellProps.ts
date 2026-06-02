import type { Animated } from "react-native";

/** Scroll + venue chrome shared by immersive booking steps. */
export type ReservationImmersiveShellProps = {
  restaurantName: string;
  hasVenue: boolean;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onBack?: () => void;
  restoreScrollY?: number;
  scrollRestoreToken?: number;
  /** When true, native scroll is synced to shared `scrollY` (builder enter matches landing reserve scroll). */
  presentationActive?: boolean;
  /** Bumps when opening builder from landing — syncs native scroll on enter. */
  enterScrollToken?: number;
  /** Target scroll when entering builder from Reserve a table (card below top nav). */
  enterScrollTargetY?: number;
  sheetScrollEnabled?: boolean;
  cardOverlayBack?: boolean;
  cardOverlayClose?: boolean;
  onClose?: () => void;
  scrollRefExternal?: React.RefObject<import("react-native").ScrollView | null>;
  bookStep?: number;
  embedHero?: boolean;
};

/** Pass scroll + venue props through to `ReservationImmersiveStepShell`. */
export function immersiveShellPassThrough(props: ReservationImmersiveShellProps) {
  return {
    restaurantName: props.restaurantName,
    hasVenue: props.hasVenue,
    scrollY: props.scrollY,
    onScroll: props.onScroll,
    scrollTopPad: props.scrollTopPad,
    scrollBottom: props.scrollBottom,
    onBack: props.onBack,
    restoreScrollY: props.restoreScrollY,
    scrollRestoreToken: props.scrollRestoreToken,
    presentationActive: props.presentationActive,
    enterScrollToken: props.enterScrollToken,
    enterScrollTargetY: props.enterScrollTargetY,
    sheetScrollEnabled: props.sheetScrollEnabled,
    cardOverlayBack: props.cardOverlayBack,
    cardOverlayClose: props.cardOverlayClose,
    onClose: props.onClose,
    scrollRefExternal: props.scrollRefExternal,
    bookStep: props.bookStep,
    embedHero: props.embedHero
  };
}
