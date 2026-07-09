import { hapticConfirm } from "../../mobile/appHaptics";
import React from "react";
import {
  Keyboard,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ReviewFeedbackSubmitIcon } from "./reviewFeedbackIcons";
import { REVIEW_FEEDBACK_PRESETS, REVIEW_SMILE_PATH } from "./reviewFeedbackPresets";

const SNAP_MS = 220;
const SNAP_EASE = Easing.out(Easing.cubic);
const COMPOSE_MS = 380;
const COMPOSE_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const INDICATOR_SIZE = 40;
const TRACK_PAD = 12;
const COMPOSE_FONT_MAX = 40;
const COMPOSE_LINE_HEIGHT_MAX = 46;
const COMPOSE_TOP_PAD = 72;
const COLLAPSED_FIELD_H = 88;
const COLLAPSED_FIELD_RADIUS = COLLAPSED_FIELD_H / 2;
const KEYBOARD_DISMISS_STRIP_H = 80;
const SUBMIT_BTN_SIZE = 44;
const SUBMIT_ICON_SIZE = 20;
const COMPOSE_SUBMIT_BAR_H = 52;
const COMPOSE_SUBMIT_GAP = 12;
const COMPOSE_SWIPE_DISMISS_Y = 32;
const COMPOSE_SWIPE_DISMISS_VY = 420;

const STOP_LABELS = ["Bad", "Not Bad", "Good"] as const;
const BG_COLORS = REVIEW_FEEDBACK_PRESETS.map((p) => p.bgColor);
const TITLE_COLORS = REVIEW_FEEDBACK_PRESETS.map((p) => p.titleColor);
const EYE_WIDTHS = REVIEW_FEEDBACK_PRESETS.map((p) => p.eyeWidth);
const EYE_HEIGHTS = REVIEW_FEEDBACK_PRESETS.map((p) => p.eyeHeight);
const EYE_RADII = REVIEW_FEEDBACK_PRESETS.map((p) => p.eyeRadius);
const EYE_BGS = REVIEW_FEEDBACK_PRESETS.map((p) => p.eyeBg);
const SMILE_COLORS = REVIEW_FEEDBACK_PRESETS.map((p) => p.smileColor);
const INDICATOR_BGS = REVIEW_FEEDBACK_PRESETS.map((p) => p.indicatorColor);
const INDICATOR_PATH_COLORS = REVIEW_FEEDBACK_PRESETS.map((p) => p.pathColor);
const TRACK_COLORS = REVIEW_FEEDBACK_PRESETS.map((p) => p.trackColor);
const TEXT_COLORS = REVIEW_FEEDBACK_PRESETS.map((p) => p.textColor);
const INPUT_SURFACES = REVIEW_FEEDBACK_PRESETS.map((p) => p.inputSurface);
const INPUT_BORDERS = REVIEW_FEEDBACK_PRESETS.map((p) => p.inputBorder);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const COMMENT_PLACEHOLDER = "Add a note…";

function clampProgress(n: number): number {
  "worklet";
  return Math.min(2, Math.max(0, n));
}

/** Shrinks compose typography as the message grows — keeps the canvas feeling open. */
function composeFontScale(charCount: number): number {
  "worklet";
  if (charCount <= 24) return 1;
  if (charCount <= 56) return 0.94;
  if (charCount <= 110) return 0.86;
  if (charCount <= 180) return 0.76;
  if (charCount <= 260) return 0.68;
  return Math.max(0.56, 0.68 - (charCount - 260) * 0.00032);
}

function SmileArc(props: { progress: SharedValue<number> }) {
  const pathProps = useAnimatedProps(() => ({
    fill: interpolateColor(props.progress.value, [0, 1, 2], SMILE_COLORS)
  }));

  return (
    <View style={styles.smileWrap}>
      <Svg width={56} height={32} viewBox="0 0 431 241">
        <AnimatedPath
          fillRule="evenodd"
          clipRule="evenodd"
          d={REVIEW_SMILE_PATH}
          animatedProps={pathProps}
        />
      </Svg>
    </View>
  );
}

function IndicatorSmile(props: { progress: SharedValue<number> }) {
  const pathProps = useAnimatedProps(() => ({
    fill: interpolateColor(props.progress.value, [0, 1, 2], INDICATOR_PATH_COLORS)
  }));

  return (
    <Svg width={22} height={12} viewBox="0 0 431 241">
      <AnimatedPath fillRule="evenodd" clipRule="evenodd" d={REVIEW_SMILE_PATH} animatedProps={pathProps} />
    </Svg>
  );
}

export type ReviewFeedbackExperienceHandle = {
  collapseCompose: () => void;
};

type ReviewFeedbackExperienceProps = {
  onComposeActiveChange?: (active: boolean) => void;
};

/** Animated visit feedback — draggable mood slider with continuous color morph. */
export const ReviewFeedbackExperience = React.forwardRef<
  ReviewFeedbackExperienceHandle,
  ReviewFeedbackExperienceProps
>(function ReviewFeedbackExperience(props, ref) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentW = Math.min(400, screenW - 32);
  const noteW = contentW;
  const [comment, setComment] = React.useState("");
  const [composeActive, setComposeActive] = React.useState(false);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const [sendStaged, setSendStaged] = React.useState(false);
  const [caretColor, setCaretColor] = React.useState(TITLE_COLORS[0]);
  const keyboardOpenRef = React.useRef(false);
  const inputFocusedRef = React.useRef(false);
  const commentInputRef = React.useRef<TextInput>(null);
  const keyboard = useAnimatedKeyboard();
  const focusProgress = useSharedValue(0);
  const composeFontScaleSV = useSharedValue(1);
  const commentRestBottom = Math.max(insets.bottom, 16) + 12;
  const composeTop = insets.top + COMPOSE_TOP_PAD;

  const progress = useSharedValue(0);
  const noteWidth = useSharedValue(noteW);
  const stop0X = useSharedValue(TRACK_PAD);
  const stop1X = useSharedValue(contentW / 2);
  const stop2X = useSharedValue(contentW - TRACK_PAD);
  const dragStartProgress = useSharedValue(0);
  const noteShift = useSharedValue(0);
  const lastLandStep = useSharedValue(0);

  React.useEffect(() => {
    noteWidth.value = noteW;
    noteShift.value = -progress.value * noteW;
    lastLandStep.value = Math.round(progress.value);
  }, [noteW, noteShift, noteWidth, progress, lastLandStep]);

  const fireStepLandHaptic = React.useCallback(() => {
    /* navigation — stay silent */
  }, []);

  const animateCompose = React.useCallback(
    (active: boolean) => {
      setComposeActive(active);
      props.onComposeActiveChange?.(active);
      focusProgress.value = withTiming(active ? 1 : 0, {
        duration: COMPOSE_MS,
        easing: COMPOSE_EASE
      });
    },
    [focusProgress, props.onComposeActiveChange]
  );

  const dismissCompose = React.useCallback(() => {
    Keyboard.dismiss();
    commentInputRef.current?.blur();
  }, []);

  React.useImperativeHandle(ref, () => ({ collapseCompose: dismissCompose }), [dismissCompose]);

  const dismissComposeIfKeyboard = React.useCallback(() => {
    if (!keyboardOpenRef.current) return;
    dismissCompose();
  }, [dismissCompose]);

  const handleComposeSubmit = React.useCallback(() => {
    if (!comment.trim()) return;
    setSendStaged(true);
    hapticConfirm();
    dismissCompose();
  }, [comment, dismissCompose]);

  const handleCollapsedSubmit = React.useCallback(() => {
    if (!sendStaged || !comment.trim()) return;
    hapticConfirm();
    setSendStaged(false);
  }, [comment, sendStaged]);

  const showComposeSubmit = composeActive || keyboardOpen;
  const showCollapsedSubmit = !showComposeSubmit;

  React.useEffect(() => {
    keyboardOpenRef.current = keyboardOpen;
  }, [keyboardOpen]);

  React.useEffect(() => {
    const onShow = () => setKeyboardOpen(true);
    const onHide = () => setKeyboardOpen(false);
    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const syncCaretColor = React.useCallback((step: number) => {
    const idx = Math.min(2, Math.max(0, step));
    setCaretColor(TITLE_COLORS[idx]);
  }, []);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (step, prev) => {
      if (step === prev) return;
      runOnJS(syncCaretColor)(step);
    },
    [syncCaretColor]
  );

  React.useEffect(() => {
    if (!composeActive) return;
    const focusTimer = setTimeout(() => {
      commentInputRef.current?.focus();
    }, 40);
    return () => clearTimeout(focusTimer);
  }, [composeActive]);

  React.useEffect(() => {
    if (!composeActive || !keyboardOpen) return;
    const focusTimer = setTimeout(() => {
      commentInputRef.current?.focus();
    }, 16);
    return () => clearTimeout(focusTimer);
  }, [composeActive, keyboardOpen]);

  const onCommentFocus = React.useCallback(() => {
    inputFocusedRef.current = true;
    animateCompose(true);
  }, [animateCompose]);

  const onCommentBlur = React.useCallback(() => {
    inputFocusedRef.current = false;
    setKeyboardOpen(false);
    animateCompose(false);
  }, [animateCompose]);

  const composeDismissPan = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([14, 9999])
        .failOffsetX([-28, 28])
        .onEnd((e) => {
          if (e.translationY > COMPOSE_SWIPE_DISMISS_Y || e.velocityY > COMPOSE_SWIPE_DISMISS_VY) {
            runOnJS(dismissComposeIfKeyboard)();
          }
        }),
    [dismissComposeIfKeyboard]
  );

  const composeDismissPanIdle = React.useMemo(() => Gesture.Pan().enabled(false), []);

  const onCommentChange = React.useCallback(
    (text: string) => {
      setComment(text);
      setSendStaged(false);
      composeFontScaleSV.value = withTiming(composeFontScale(text.length), {
        duration: 200,
        easing: SNAP_EASE
      });
    },
    [composeFontScaleSV]
  );

  React.useEffect(() => {
    composeFontScaleSV.value = composeFontScale(comment.length);
  }, [comment, composeFontScaleSV]);

  const snapTo = React.useCallback(
    (index: number, haptic: boolean) => {
      lastLandStep.value = index;
      progress.value = withTiming(index, { duration: SNAP_MS, easing: SNAP_EASE }, (finished) => {
        if (finished && haptic) runOnJS(fireStepLandHaptic)();
      });
      noteShift.value = withTiming(-index * noteW, { duration: SNAP_MS, easing: SNAP_EASE });
    },
    [fireStepLandHaptic, lastLandStep, noteShift, noteW, progress]
  );

  const onStopLayout = React.useCallback(
    (index: 0 | 1 | 2, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      const center = x + width / 2;
      if (index === 0) stop0X.value = center;
      else if (index === 1) stop1X.value = center;
      else stop2X.value = center;
    },
    [stop0X, stop1X, stop2X]
  );

  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          dragStartProgress.value = progress.value;
          lastLandStep.value = Math.round(progress.value);
        })
        .onUpdate((e) => {
          const range = stop2X.value - stop0X.value;
          if (range <= 1) return;
          const next = dragStartProgress.value + (e.translationX / range) * 2;
          progress.value = clampProgress(next);
          noteShift.value = -progress.value * noteWidth.value;
          const step = Math.round(progress.value);
          if (step !== lastLandStep.value) {
            lastLandStep.value = step;
            runOnJS(fireStepLandHaptic)();
          }
        })
        .onEnd(() => {
          const snapped = Math.round(progress.value);
          const shouldHaptic = snapped !== lastLandStep.value;
          if (shouldHaptic) lastLandStep.value = snapped;
          progress.value = withTiming(snapped, { duration: SNAP_MS, easing: SNAP_EASE }, (finished) => {
            if (finished && shouldHaptic) runOnJS(fireStepLandHaptic)();
          });
          noteShift.value = withTiming(-snapped * noteWidth.value, {
            duration: SNAP_MS,
            easing: SNAP_EASE
          });
        }),
    [dragStartProgress, fireStepLandHaptic, lastLandStep, noteShift, noteWidth, progress, stop0X, stop2X]
  );

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1, 2], BG_COLORS)
  }));

  const titleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1, 2], TITLE_COLORS)
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1, 2], EYE_WIDTHS),
    height: interpolate(progress.value, [0, 1, 2], EYE_HEIGHTS),
    borderRadius: interpolate(progress.value, [0, 1, 2], EYE_RADII),
    backgroundColor: interpolateColor(progress.value, [0, 1, 2], EYE_BGS)
  }));

  const smileRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1, 2], [180, 180, 0])}deg` }]
  }));

  const noteStripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * noteWidth.value }]
  }));

  const indicatorStyle = useAnimatedStyle(() => {
    const x = interpolate(progress.value, [0, 1, 2], [stop0X.value, stop1X.value, stop2X.value]);
    return {
      transform: [
        { translateX: x - INDICATOR_SIZE / 2 },
        { rotate: `${interpolate(progress.value, [0, 1, 2], [180, 180, 0])}deg` }
      ]
    };
  });

  const indicatorBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1, 2], INDICATOR_BGS)
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1, 2], TRACK_COLORS)
  }));

  const labelColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1, 2], TEXT_COLORS)
  }));

  const label0Opacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1, 2], [1, 0.45, 0.35])
  }));
  const label1Opacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1, 2], [0.35, 1, 0.35])
  }));
  const label2Opacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1, 2], [0.35, 0.45, 1])
  }));
  const labelOpacities = [label0Opacity, label1Opacity, label2Opacity];

  const note0Opacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [-0.35, 0, 0.35], [0, 1, 0])
  }));
  const note1Opacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.65, 1, 1.35], [0, 1, 0])
  }));
  const note2Opacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [1.65, 2, 2.35], [0, 1, 0])
  }));

  const inputShellStyle = useAnimatedStyle(() => {
    const f = focusProgress.value;
    const kb = keyboard.height.value;
    const collapsedTop = screenH - COLLAPSED_FIELD_H - commentRestBottom;
    const shellBg = interpolateColor(progress.value, [0, 1, 2], INPUT_SURFACES);
    const shellBorder = interpolateColor(progress.value, [0, 1, 2], INPUT_BORDERS);
    return {
      top: interpolate(f, [0, 1], [collapsedTop, composeTop]),
      bottom: interpolate(f, [0, 1], [commentRestBottom, kb + 20]),
      left: interpolate(f, [0, 1], [16, 20]),
      right: interpolate(f, [0, 1], [16, 20]),
      borderWidth: interpolate(f, [0, 1], [1.5, 0]),
      borderRadius: interpolate(f, [0, 1], [COLLAPSED_FIELD_RADIUS, 0]),
      backgroundColor: interpolateColor(f, [0, 1], [shellBg, "#00000000"]),
      borderColor: interpolateColor(f, [0, 1], [shellBorder, "#00000000"]),
      paddingHorizontal: interpolate(f, [0, 1], [16, 4]),
      paddingVertical: interpolate(f, [0, 1], [15, 8]),
      transform: [{ scale: interpolate(f, [0, 0.55, 1], [1, 1.02, 1]) }]
    };
  });

  const keyboardDismissStripStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + COMPOSE_SUBMIT_GAP + COMPOSE_SUBMIT_BAR_H + 6,
    height: KEYBOARD_DISMISS_STRIP_H,
    opacity: interpolate(focusProgress.value, [0, 0.2, 1], [0, 0, 1])
  }));

  const composeSubmitBarStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + COMPOSE_SUBMIT_GAP,
    opacity: interpolate(focusProgress.value, [0.28, 0.55], [0, 1]),
    transform: [{ translateY: interpolate(focusProgress.value, [0, 1], [14, 0]) }]
  }));

  const inputTextStyle = useAnimatedStyle(() => {
    const f = focusProgress.value;
    const scale = composeFontScaleSV.value;
    const composeSize = COMPOSE_FONT_MAX * scale;
    const composeLine = COMPOSE_LINE_HEIGHT_MAX * scale;
    return {
      color: interpolateColor(progress.value, [0, 1, 2], TITLE_COLORS),
      fontSize: interpolate(f, [0, 1], [16, composeSize]),
      lineHeight: interpolate(f, [0, 1], [22, composeLine]),
      letterSpacing: interpolate(f, [0, 1], [0, -0.6]),
      maxHeight: interpolate(f, [0, 1], [58, 2000])
    };
  });

  const collapsedPlaceholderStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1, 2], TITLE_COLORS),
    fontSize: COMPOSE_FONT_MAX,
    lineHeight: COMPOSE_LINE_HEIGHT_MAX,
    letterSpacing: -0.6,
    opacity: interpolate(focusProgress.value, [0, 0.18], [1, 0])
  }));

  const collapsedSubmitWrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusProgress.value, [0, 0.18], [1, 0]),
    transform: [{ scale: interpolate(focusProgress.value, [0, 0.18], [1, 0.88]) }]
  }));

  const submitBtnStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1, 2], INDICATOR_BGS)
  }));

  const stageFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusProgress.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(focusProgress.value, [0, 1], [1, 0.98]) }]
  }));

  return (
    <Animated.View style={[styles.fill, bgStyle]}>
      <Animated.View
        style={[styles.stage, stageFadeStyle]}
        pointerEvents={composeActive ? "none" : "auto"}
      >
        <View style={[styles.column, { width: contentW }]}>
        <View style={styles.titleBlock}>
          <Animated.Text style={[styles.titleLine, titleStyle]}>How was your visit</Animated.Text>
          <Animated.Text style={[styles.titleLine, titleStyle]}>today?</Animated.Text>
        </View>

        <View style={styles.faceBlock}>
          <View style={styles.eyesRow}>
            <Animated.View style={[styles.eye, eyeStyle]} />
            <Animated.View style={[styles.eye, eyeStyle]} />
          </View>
          <Animated.View style={smileRotateStyle}>
            <SmileArc progress={progress} />
          </Animated.View>
        </View>

        <View style={[styles.noteViewport, { width: noteW }]}>
          <Animated.View style={[styles.noteStrip, { width: noteW * 3 }, noteStripStyle]}>
            {REVIEW_FEEDBACK_PRESETS.map((p, i) => (
              <Animated.View
                key={p.noteLabel}
                style={[
                  styles.noteCell,
                  { width: noteW },
                  i === 0 ? note0Opacity : i === 1 ? note1Opacity : note2Opacity
                ]}
              >
                <Text style={[styles.noteText, { color: p.noteColor }]}>{p.noteLabel}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        </View>

        <View style={styles.sliderBlock}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.trackTouch}>
              <View style={styles.trackRow}>
                {([0, 1, 2] as const).map((i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={STOP_LABELS[i]}
                    onPress={() => snapTo(i, true)}
                    onLayout={(e) => onStopLayout(i, e)}
                    style={styles.stopHit}
                    hitSlop={10}
                  >
                    <Animated.View style={[styles.stopDot, trackStyle]} />
                  </Pressable>
                ))}
                <Animated.View style={[styles.trackLine, trackStyle]} pointerEvents="none" />
                <Animated.View
                  style={[styles.indicator, indicatorBgStyle, indicatorStyle]}
                  pointerEvents="none"
                >
                  <View style={styles.indicatorInner}>
                    <IndicatorSmile progress={progress} />
                  </View>
                </Animated.View>
              </View>
            </View>
          </GestureDetector>

          <View style={styles.labelsRow}>
            {STOP_LABELS.map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => snapTo(i as 0 | 1 | 2, true)}
                style={styles.labelHit}
              >
                <Animated.Text
                  style={[
                    styles.stopLabel,
                    i === 0 && styles.stopLabelLeft,
                    i === 1 && styles.stopLabelCenter,
                    i === 2 && styles.stopLabelRight,
                    labelColorStyle,
                    labelOpacities[i]
                  ]}
                >
                  {label}
                </Animated.Text>
              </Pressable>
            ))}
          </View>
        </View>
        </View>
      </Animated.View>

      {keyboardOpen ? (
        <GestureDetector gesture={composeDismissPan}>
          <Animated.View style={styles.composeBackdrop} pointerEvents="box-none">
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={dismissComposeIfKeyboard}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            />
          </Animated.View>
        </GestureDetector>
      ) : null}

      {keyboardOpen ? (
        <GestureDetector gesture={composeDismissPan}>
          <Animated.View style={[styles.keyboardDismissStrip, keyboardDismissStripStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={dismissComposeIfKeyboard}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            />
          </Animated.View>
        </GestureDetector>
      ) : null}

      {showComposeSubmit ? (
        <Animated.View
          style={[styles.composeSubmitDock, composeSubmitBarStyle]}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done typing — collapse message field"
            accessibilityState={{ disabled: !comment.trim() }}
            disabled={!comment.trim()}
            onPress={handleComposeSubmit}
            style={({ pressed }) => [
              styles.composeSubmitPressable,
              !comment.trim() && styles.composeSubmitDisabled,
              pressed && !!comment.trim() && styles.submitBtnPressed
            ]}
          >
            <Animated.View style={[styles.composeSubmitBar, submitBtnStyle]}>
              <ReviewFeedbackSubmitIcon size={SUBMIT_ICON_SIZE} color="#FFFFFF" />
              <Text style={styles.composeSubmitLabel}>Submit</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.commentDock, inputShellStyle]} pointerEvents="box-none">
        <GestureDetector gesture={keyboardOpen ? composeDismissPan : composeDismissPanIdle}>
          <View style={styles.commentInputRow} pointerEvents="box-none">
            <View
              style={[styles.commentInputWrap, !composeActive && styles.commentInputWrapCollapsed]}
              pointerEvents="box-none"
            >
              {!composeActive && comment.length === 0 ? (
                <View style={styles.collapsedPlaceholderWrap} pointerEvents="none">
                  <Animated.Text
                    numberOfLines={2}
                    style={[styles.collapsedPlaceholderText, collapsedPlaceholderStyle]}
                  >
                    {COMMENT_PLACEHOLDER}
                  </Animated.Text>
                </View>
              ) : null}
              <AnimatedTextInput
                ref={commentInputRef}
                value={comment}
                onChangeText={onCommentChange}
                onFocus={onCommentFocus}
                onBlur={onCommentBlur}
                placeholder=""
                multiline
                scrollEnabled
                showSoftInputOnFocus
                autoFocus={false}
                caretHidden={false}
                cursorColor={caretColor}
                selectionColor={caretColor}
                {...(Platform.OS === "android" ? { underlineColorAndroid: "transparent" } : {})}
                textAlignVertical={composeActive ? "top" : "top"}
                style={[
                  styles.commentInput,
                  composeActive ? styles.commentInputCompose : styles.commentInputRest,
                  composeActive && styles.commentInputComposeCaret,
                  inputTextStyle
                ]}
                accessibilityLabel="Visit feedback comments"
              />
            </View>

            {showCollapsedSubmit ? (
              <Animated.View
                style={[styles.submitBtnWrap, collapsedSubmitWrapStyle]}
                pointerEvents="auto"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    sendStaged
                      ? "Send visit feedback"
                      : "Finish typing first, then submit from here"
                  }
                  accessibilityState={{ disabled: !sendStaged || !comment.trim() }}
                  onPress={handleCollapsedSubmit}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!sendStaged || !comment.trim()) && styles.collapsedSubmitIdle,
                    pressed && sendStaged && comment.trim() && styles.submitBtnPressed
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.submitBtnCircle,
                      submitBtnStyle,
                      sendStaged && comment.trim() && styles.submitBtnCircleStaged
                    ]}
                  >
                    <ReviewFeedbackSubmitIcon size={SUBMIT_ICON_SIZE} color="#FFFFFF" />
                  </Animated.View>
                </Pressable>
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fill: {
    flex: 1
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  composeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4
  },
  keyboardDismissStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 5
  },
  column: {
    alignItems: "center"
  },
  commentDock: {
    position: "absolute",
    zIndex: 6,
    overflow: "hidden"
  },
  commentInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    width: "100%"
  },
  commentInputWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center"
  },
  commentInputWrapCollapsed: {
    paddingRight: 4
  },
  collapsedPlaceholderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingRight: SUBMIT_BTN_SIZE + 6
  },
  composeSubmitDock: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 7
  },
  composeSubmitPressable: {
    width: "100%"
  },
  composeSubmitBar: {
    height: COMPOSE_SUBMIT_BAR_H,
    borderRadius: COMPOSE_SUBMIT_BAR_H / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4
  },
  composeSubmitLabel: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.35
  },
  composeSubmitDisabled: {
    opacity: 0.45
  },
  submitBtnWrap: {
    marginLeft: 8,
    flexShrink: 0
  },
  collapsedSubmitIdle: {
    opacity: 0.5
  },
  submitBtnCircleStaged: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)"
  },
  submitBtn: {
    alignItems: "center",
    justifyContent: "center"
  },
  submitBtnCircle: {
    width: SUBMIT_BTN_SIZE,
    height: SUBMIT_BTN_SIZE,
    borderRadius: SUBMIT_BTN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }]
  },
  collapsedPlaceholderText: {
    fontWeight: "700",
    textAlign: "left"
  },
  commentInput: {
    flex: 1,
    width: "100%",
    minHeight: 44,
    padding: 0,
    margin: 0,
    backgroundColor: "transparent"
  },
  commentInputRest: {
    fontWeight: "500",
    textAlign: "left"
  },
  commentInputCompose: {
    fontWeight: "700",
    textAlign: "center"
  },
  commentInputComposeCaret: {
    minHeight: 120,
    paddingTop: 10,
    paddingBottom: 10
  },
  titleBlock: {
    alignItems: "center",
    marginBottom: 28,
    maxWidth: 320
  },
  titleLine: {
    fontSize: 40,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.6,
    lineHeight: 46
  },
  faceBlock: {
    height: 176,
    alignItems: "center",
    justifyContent: "center"
  },
  eyesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32
  },
  eye: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  smileWrap: {
    width: 56,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  noteViewport: {
    overflow: "hidden",
    height: 72,
    marginTop: 8,
    marginBottom: 20
  },
  noteStrip: {
    flexDirection: "row"
  },
  noteCell: {
    alignItems: "center",
    justifyContent: "center"
  },
  noteText: {
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1
  },
  sliderBlock: {
    width: "100%",
    paddingBottom: 8
  },
  trackTouch: {
    width: "100%",
    paddingVertical: 10,
    marginBottom: 4
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 40
  },
  stopHit: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  stopDot: {
    width: 24,
    height: 24,
    borderRadius: 12
  },
  trackLine: {
    position: "absolute",
    left: TRACK_PAD,
    right: TRACK_PAD,
    top: "50%",
    marginTop: -2,
    height: 4,
    borderRadius: 2,
    zIndex: 1
  },
  indicator: {
    position: "absolute",
    top: "50%",
    marginTop: -INDICATOR_SIZE / 2,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  indicatorInner: {
    paddingTop: 2
  },
  labelsRow: {
    flexDirection: "row",
    width: "100%"
  },
  labelHit: {
    flex: 1,
    paddingVertical: 8
  },
  stopLabel: {
    fontSize: 14,
    fontWeight: "600"
  },
  stopLabelLeft: {
    textAlign: "left"
  },
  stopLabelCenter: {
    textAlign: "center"
  },
  stopLabelRight: {
    textAlign: "right"
  }
});
