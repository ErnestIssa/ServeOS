import type { ViewStyle } from "react-native";

type Args = {
  mine: boolean;
  showTail: boolean;
  groupWithPrev: boolean;
  groupWithNext: boolean;
  radius: number;
  grouped: number;
  tailCorner: number;
};

/** Asymmetric radii so the tail corner stays tight and the pointer feels attached. */
export function bubbleCornerRadii({
  mine,
  showTail,
  groupWithPrev,
  groupWithNext,
  radius,
  grouped,
  tailCorner
}: Args): ViewStyle {
  const tailAttach = showTail && !groupWithNext ? tailCorner : groupWithNext ? grouped : radius;

  if (mine) {
    return {
      borderTopLeftRadius: groupWithPrev ? grouped : radius,
      borderTopRightRadius: groupWithPrev ? grouped : radius,
      borderBottomLeftRadius: groupWithNext ? grouped : radius,
      borderBottomRightRadius: tailAttach
    };
  }

  return {
    borderTopLeftRadius: groupWithPrev ? grouped : radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: tailAttach,
    borderBottomRightRadius: groupWithNext ? grouped : radius
  };
}
