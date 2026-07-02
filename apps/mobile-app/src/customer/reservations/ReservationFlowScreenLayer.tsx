import React from "react";
import { Animated, Dimensions, Platform, StyleSheet } from "react-native";

export type ReservationSlideDirection = "forward" | "back";
export type ReservationSlidePhase = "enter" | "exit";

const screenW = Dimensions.get("window").width;
/** Horizontal travel — forward steps enter from the right; back steps enter from the left. */
const SLIDE_OFFSET = Platform.OS === "web" ? 0 : screenW;
export const RESERVATION_SLIDE_ENTER_MS = 340;
export const RESERVATION_SLIDE_EXIT_MS = 300;
const ENTER_MS = RESERVATION_SLIDE_ENTER_MS;
const EXIT_MS = RESERVATION_SLIDE_EXIT_MS;

type Props = {
  active: boolean;
  slidePhase?: ReservationSlidePhase | null;
  slideDirection?: ReservationSlideDirection | null;
  children: React.ReactNode;
};

/** Keeps booking steps mounted; step changes use a short horizontal slide. */
export function ReservationFlowScreenLayer(props: Props) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(props.active ? 1 : 0)).current;
  const visible = props.active || props.slidePhase === "exit";

  React.useEffect(() => {
    if (SLIDE_OFFSET === 0) {
      translateX.setValue(0);
      opacity.setValue(props.active ? 1 : 0);
      return;
    }

    const dir = props.slideDirection;
    if (props.slidePhase === "enter" && dir) {
      const from = dir === "forward" ? SLIDE_OFFSET : -SLIDE_OFFSET;
      translateX.setValue(from);
      opacity.setValue(0.92);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: ENTER_MS,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTER_MS,
          useNativeDriver: true
        })
      ]).start();
      return;
    }

    if (props.slidePhase === "exit" && dir) {
      const to = dir === "forward" ? -SLIDE_OFFSET * 0.28 : SLIDE_OFFSET * 0.28;
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: to,
          duration: EXIT_MS,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS - 20,
          useNativeDriver: true
        })
      ]).start();
      return;
    }

    if (props.active) {
      translateX.setValue(0);
      opacity.setValue(1);
    } else if (!props.slidePhase) {
      translateX.setValue(0);
      opacity.setValue(0);
    }
  }, [props.active, props.slideDirection, props.slidePhase, opacity, translateX]);

  if (!visible) return null;

  const zIndex =
    props.slidePhase === "enter" ? 3 : props.slidePhase === "exit" ? 1 : props.active ? 2 : 0;

  return (
    <Animated.View
      style={[
        styles.layer,
        { zIndex },
        {
          opacity,
          transform: [{ translateX }]
        }
      ]}
      pointerEvents={props.active ? "auto" : "none"}
      accessibilityElementsHidden={!props.active}
      importantForAccessibility={props.active ? "auto" : "no-hide-descendants"}
    >
      {props.children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject
  }
});
