import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View
} from "react-native";
import type { AmbientNativeTab } from "@serveos/core-ambient/themes";
import { ambientNativePalettes } from "@serveos/core-ambient/themes";
import { NotificationsInboxScreen } from "../notifications/NotificationsInboxScreen";
import { useAppTheme } from "../theme/AppThemeContext";

function mixHex(top: string, bottom: string, t: number): string {
  const hex = (c: string) => c.replace("#", "").trim();
  const parse = (s: string) => {
    const h = hex(s);
    const full = h.length === 6 ? h : h.split("").map((x) => x + x).join("");
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
  };
  const A = parse(top);
  const B = parse(bottom);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[mix(A.r, B.r), mix(A.g, B.g), mix(A.b, B.b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const OPEN_MS = 320;
const CLOSE_MS = 300;

type Props = {
  visible: boolean;
  topInset: number;
  bottomInset: number;
  ambientTab: AmbientNativeTab;
  authToken: string | null;
  onBack: () => void;
  onUnreadCountChange?: (count: number) => void;
};

export function NotificationsInboxPage(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const { visible, topInset, bottomInset, onBack, authToken } = props;

  const gradientColors = React.useMemo<[string, string, string]>(() => {
    if (isDark) return t.menuGradient;
    const { top, bottom } = ambientNativePalettes[props.ambientTab];
    return [top, mixHex(top, bottom, 0.45), bottom];
  }, [isDark, props.ambientTab, t.menuGradient]);

  const screenW = Dimensions.get("window").width;
  const slideX = React.useRef(new Animated.Value(screenW)).current;
  const scrim = React.useRef(new Animated.Value(0)).current;
  const closingRef = React.useRef(false);
  const [presented, setPresented] = React.useState(visible);

  const runOpen = React.useCallback(() => {
    slideX.setValue(screenW);
    scrim.setValue(0);
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(scrim, {
        toValue: 1,
        duration: OPEN_MS - 40,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [scrim, screenW, slideX]);

  const runClose = React.useCallback(
    (done: () => void) => {
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: screenW,
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(scrim, {
          toValue: 0,
          duration: CLOSE_MS - 40,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (finished) done();
      });
    },
    [scrim, screenW, slideX]
  );

  React.useEffect(() => {
    if (visible) {
      setPresented(true);
      runOpen();
      return;
    }
    if (!presented) return;
    if (closingRef.current) return;
    closingRef.current = true;
    runClose(() => {
      closingRef.current = false;
      setPresented(false);
    });
  }, [visible, presented, runClose, runOpen]);

  const handleClose = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  if (!presented) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Close notifications" />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: isDark ? t.bg : ambientNativePalettes[props.ambientTab].top,
              transform: [{ translateX: slideX }]
            }
          ]}
        >
          <LinearGradient colors={gradientColors} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          {authToken ? (
            <NotificationsInboxScreen
              authToken={authToken}
              topInset={topInset}
              bottomInset={bottomInset}
              onBack={handleClose}
              onUnreadCountChange={props.onUnreadCountChange}
            />
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: { flex: 1, overflow: "hidden" }
});
