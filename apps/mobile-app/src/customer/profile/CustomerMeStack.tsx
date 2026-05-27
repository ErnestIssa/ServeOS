import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { AuthUser } from "../../api";
import { useAppTheme } from "../../theme/AppThemeContext";
import { CustomerMeHub } from "./CustomerMeHub";
import { ProfilePlaceholderScreen } from "./ProfilePlaceholderScreen";
import type { MeStackRoute } from "./profileHubRoutes";
import { ProfileNavHighlightProvider, useProfileNavHighlight } from "./profileNavHighlight";

type Props = {
  topInset: number;
  /** Safe-area only — used on sub-screens when the floating top nav is hidden. */
  compactTopInset: number;
  bottomInset: number;
  user: AuthUser | null;
  venueName: string;
  activeOrderCount: number;
  onOpenBookings: () => void;
  onOpenOrders: () => void;
  onOpenSupport: () => void;
  onSignOut: () => void;
  onAvatarSaved?: (uri: string) => void;
  onAtRootChange?: (atRoot: boolean) => void;
};

function BackChevron({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M14.707 17.293a1 1 0 0 1-1.414 1.414l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 1.414L9.414 12l5.293 5.293Z"
      />
    </Svg>
  );
}

function CustomerMeStackInner(props: Props) {
  const { colors: t } = useAppTheme();
  const { navigate, onReturnedToMeHome } = useProfileNavHighlight();
  const [stack, setStack] = React.useState<MeStackRoute[]>([{ name: "home" }]);

  const route = stack[stack.length - 1]!;
  const atRoot = stack.length <= 1;
  const title = route.name === "section" ? route.title : null;

  const push = React.useCallback((next: MeStackRoute) => {
    setStack((s) => [...s, next]);
  }, []);

  const pop = React.useCallback(() => {
    setStack((s) => {
      if (s.length <= 1) return s;
      const next = s.slice(0, -1);
      if (next[next.length - 1]?.name === "home") onReturnedToMeHome();
      return next;
    });
  }, [onReturnedToMeHome]);

  const handleBack = React.useCallback(() => {
    if (atRoot) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop();
  }, [atRoot, pop]);

  React.useEffect(() => {
    if (!props.user) setStack([{ name: "home" }]);
  }, [props.user?.id]);

  React.useEffect(() => {
    props.onAtRootChange?.(atRoot);
  }, [atRoot, props.onAtRootChange]);

  const scrollTopInset = atRoot ? props.topInset : 0;

  const content =
    route.name === "home" ? (
      <CustomerMeHub
        user={props.user}
        venueName={props.venueName}
        topInset={scrollTopInset}
        bottomInset={props.bottomInset}
        activeOrderCount={props.activeOrderCount}
        onNavigateSection={(sectionTitle, subtitle, key) =>
          navigate(key, () => push({ name: "section", title: sectionTitle, subtitle }))
        }
        onOpenBookings={props.onOpenBookings}
        onOpenOrders={props.onOpenOrders}
        onOpenSupport={props.onOpenSupport}
        onSignOut={props.onSignOut}
        onAvatarSaved={props.onAvatarSaved}
      />
    ) : (
      <ProfilePlaceholderScreen
        title={route.title}
        subtitle={route.subtitle}
        topInset={scrollTopInset}
        bottomInset={props.bottomInset}
      />
    );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        fill: { flex: 1 },
        topBar: { paddingHorizontal: t.space.sm, zIndex: 2, minHeight: atRoot ? 0 : 36 },
        backBtn: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingRight: 10,
          gap: 2
        },
        pressed: { opacity: 0.85 },
        backLabel: { fontSize: 15, fontWeight: "600", color: t.accentBlue },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: t.text,
          textAlign: "center",
          marginTop: 2,
          marginBottom: 4
        },
        content: { flex: 1 }
      }),
    [t, atRoot]
  );

  return (
    <View style={styles.fill}>
      {!atRoot ? (
        <View style={[styles.topBar, { paddingTop: props.compactTopInset }]}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <BackChevron color={t.accentBlue} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      ) : null}
      <View style={styles.content}>{content}</View>
    </View>
  );
}

export function CustomerMeStack(props: Props) {
  return (
    <ProfileNavHighlightProvider>
      <CustomerMeStackInner {...props} />
    </ProfileNavHighlightProvider>
  );
}
