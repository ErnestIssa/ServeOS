import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ProfileReviewInfoIcon } from "./profileMenuChipIcons";
import {
  ReviewFeedbackExperience,
  type ReviewFeedbackExperienceHandle
} from "./ReviewFeedbackExperience";

type Props = {
  topInset: number;
  onClose: () => void;
};

function CloseIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6L18 18M18 6L6 18"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BackIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 6L8.5 12L14.5 18"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Full-screen visit feedback (mood face + 3-step slider). */
export function ProfileReviewScreen(props: Props) {
  const feedbackRef = React.useRef<ReviewFeedbackExperienceHandle>(null);
  const [composeActive, setComposeActive] = React.useState(false);

  const onClose = React.useCallback(() => {
    props.onClose();
  }, [props.onClose]);

  const onLeadPress = React.useCallback(() => {
    void Haptics.selectionAsync();
    if (composeActive) {
      feedbackRef.current?.collapseCompose();
      return;
    }
    onClose();
  }, [composeActive, onClose]);

  return (
    <View style={styles.root}>
      <ReviewFeedbackExperience ref={feedbackRef} onComposeActiveChange={setComposeActive} />
      <StatusBar style="dark" />
      <View style={[styles.topRow, { paddingTop: props.topInset + 8 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={composeActive ? "Back" : "Close"}
          onPress={onLeadPress}
          hitSlop={14}
          style={({ pressed }) => [styles.iconBtn, styles.iconBtnOnColor, pressed && styles.pressed]}
        >
          {composeActive ? <BackIcon color="#FFFFFF" /> : <CloseIcon color="#FFFFFF" />}
        </Pressable>

        <View style={styles.topSpacer} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review information"
          onPress={() => void Haptics.selectionAsync()}
          hitSlop={14}
          style={({ pressed }) => [styles.iconBtn, styles.iconBtnOnColor, pressed && styles.pressed]}
        >
          <ProfileReviewInfoIcon size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...Platform.select({
      ios: { zIndex: 20 },
      android: { elevation: 20 },
      default: {}
    })
  },
  topRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 44,
    zIndex: 10
  },
  topSpacer: { flex: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  iconBtnOnColor: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 22
  },
  pressed: { opacity: 0.82 }
});
