import React from "react";
import { Gesture, type NativeGesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";

export type NavSheetScrollContextValue = {
  scrollYSV: SharedValue<number>;
  scrollAtEndSV: SharedValue<number>;
  nativeScrollGesture: NativeGesture;
};

const NavSheetScrollContext = React.createContext<NavSheetScrollContextValue | null>(null);

export function NavSheetScrollProvider(props: {
  scrollYSV: SharedValue<number>;
  scrollAtEndSV: SharedValue<number>;
  nativeScrollGesture: NativeGesture;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({
      scrollYSV: props.scrollYSV,
      scrollAtEndSV: props.scrollAtEndSV,
      nativeScrollGesture: props.nativeScrollGesture
    }),
    [props.nativeScrollGesture, props.scrollAtEndSV, props.scrollYSV]
  );
  return <NavSheetScrollContext.Provider value={value}>{props.children}</NavSheetScrollContext.Provider>;
}

export function useNavSheetScrollContext(): NavSheetScrollContextValue | null {
  return React.useContext(NavSheetScrollContext);
}

/** Stable native gesture instance for simultaneous sheet pan + in-sheet scroll. */
export function createNavSheetNativeScrollGesture() {
  return Gesture.Native();
}
