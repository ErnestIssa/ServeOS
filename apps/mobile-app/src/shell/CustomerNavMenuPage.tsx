import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  View
} from "react-native";
import type { AmbientNativeTab } from "@serveos/core-ambient/themes";
import { ambientNativePalettes } from "@serveos/core-ambient/themes";
import type { AuthUser } from "../api";
import { CustomerProfileStack } from "../customer/profile/CustomerProfileStack";
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
  const r = mix(A.r, B.r);
  const g = mix(A.g, B.g);
  const b = mix(A.b, B.b);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const OPEN_MS = 320;
const CLOSE_MS = 300;

type Props = {
  visible: boolean;
  topInset: number;
  bottomInset: number;
  /** Tab behind the menu — light mode uses its ambient gradient to match the shell. */
  ambientTab: AmbientNativeTab;
  user: AuthUser | null;
  authToken?: string | null;
  onBack: () => void;
  onChooseVenue: () => void;
};

export function CustomerNavMenuPage(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const { visible, topInset, bottomInset, onBack } = props;

  const menuGradientColors = React.useMemo<[string, string, string]>(() => {
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
  }, [screenW, slideX, scrim]);

  const runClose = React.useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
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
        closingRef.current = false;
        if (!finished) return;
        setPresented(false);
        after?.();
      });
    },
    [screenW, slideX, scrim]
  );

  React.useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setPresented(true);
      return;
    }
    if (presented) runClose();
  }, [visible, presented, runClose]);

  React.useEffect(() => {
    if (presented && visible) runOpen();
  }, [presented, visible, runOpen]);

  const handleCloseMenu = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runClose(onBack);
  }, [onBack, runClose]);

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={handleCloseMenu}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: scrim }]} pointerEvents="none" />
        <Animated.View
          style={[
            styles.page,
            {
              backgroundColor: isDark ? t.bg : ambientNativePalettes[props.ambientTab].top,
              transform: [{ translateX: slideX }]
            }
          ]}
          accessibilityViewIsModal
        >
          <LinearGradient colors={menuGradientColors} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <CustomerProfileStack
            topInset={topInset}
            bottomInset={bottomInset}
            user={props.user}
            authToken={props.authToken}
            onCloseMenu={handleCloseMenu}
            onChooseVenue={() => {
              handleCloseMenu();
              props.onChooseVenue();
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-start" },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.18)"
  },
  page: {
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: -6, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 24
      },
      android: { elevation: 16 }
    })
  }
});
