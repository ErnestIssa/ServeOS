import { BlurView } from "expo-blur";
import React from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { AuthUser } from "../../api";
import { ThemedSwitch } from "../../components/ThemedSwitch";
import { hapticConfirm, hapticSelect } from "../../mobile/appHaptics";
import { useAppTheme, type ThemeColors } from "../../theme/AppThemeContext";
import { reportBottomNavScroll, useBottomNavScrollReporter } from "../../shell/BottomNavScrollReporter";
import type { ControlCentreChipManifest } from "../../mobile/mobileExperienceTypes";
import { profileFirstName, profileInitial } from "./profileDisplay";
import { NavHighlightWrap, useProfileNavHighlight, type ProfileNavHighlightKey } from "./profileNavHighlight";
import {
  ProfileChipIconHelp,
  ProfileChipIconSafety,
  ProfileChipIconSettings
} from "./profileMenuChipIcons";
import { ProfileScrollFrostedEdges } from "./profileScrollFrostedEdges";

const SCREEN_X = 22;

export { hapticSelect } from "../../mobile/appHaptics";

function useProfileStyles() {
  const { colors: t, isDark } = useAppTheme();
  return React.useMemo(() => makeProfileStyles(t, isDark), [t, isDark]);
}

function makeProfileStyles(t: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    screenPad: { paddingHorizontal: SCREEN_X },
    card: {
      backgroundColor: t.bg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      padding: t.space.sm,
      marginBottom: t.space.sm,
      ...Platform.select({
        ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
        android: { elevation: 2 }
      })
    },
    cardNoPad: { paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" },
    pressed: { opacity: 0.9 },
    profileHero: { marginBottom: 0 },
    profileHeroBorder: {
      borderWidth: 1,
      borderColor: t.accentPurple,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14
    },
    profileHeroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between"
    },
    profileIdentityCol: { flex: 1, alignItems: "flex-start", paddingRight: 12 },
    profileAvatarRing: {
      padding: 2,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: t.accentPurple,
      marginBottom: 10
    },
    profileAvatarInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: isDark ? "rgba(96, 165, 250, 0.2)" : "rgba(59, 130, 246, 0.15)"
    },
    profileAvatarImage: { width: 64, height: 64, borderRadius: 32 },
    profileAvatarInitial: { fontSize: 26, fontWeight: "900", color: t.accentBlue },
    profileFirstName: {
      fontSize: 20,
      fontWeight: "800",
      color: isDark ? t.text : "#0f172a",
      letterSpacing: -0.3
    },
    profileRightCol: {
      alignItems: "flex-end",
      maxWidth: "44%",
      minWidth: 108
    },
    profileMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
      gap: 12
    },
    profileVenueMeta: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: t.textSecondary,
      lineHeight: 18,
      textAlign: "right"
    },
    profileRatingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    profileRatingStar: { fontSize: 12, fontWeight: "900", color: "#EAB308" },
    profileRatingValue: { fontSize: 12, fontWeight: "700", color: t.textSecondary, letterSpacing: -0.2 },
    switchAccountBtn: {
      marginTop: 2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.danger,
      paddingHorizontal: 12,
      paddingVertical: 7,
      alignSelf: "flex-start"
    },
    switchAccountText: { fontSize: 12, fontWeight: "500", color: t.danger, letterSpacing: -0.1 },
    profileQuickChipsRow: { flexDirection: "row", marginTop: 10, marginHorizontal: -4 },
    topChipHighlightWrap: { flex: 1, marginHorizontal: 4 },
    topChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 68,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bgElevated
    },
    topChipIconWrap: { height: 24, alignItems: "center", justifyContent: "center", marginBottom: 3 },
    topChipLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", color: t.text, letterSpacing: -0.1 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: t.textMuted,
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginTop: t.space.sm,
      marginBottom: 8,
      marginLeft: 2
    },
    sectionLabelMe: {
      fontSize: 22,
      fontWeight: "900",
      color: t.accentPurple,
      letterSpacing: -0.3,
      textTransform: "none",
      marginTop: t.space.md,
      marginBottom: 10,
      marginLeft: 2
    },
    sectionRowHighlightWrap: { marginHorizontal: 2, borderRadius: 14 },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: t.space.sm,
      position: "relative"
    },
    sectionRowLast: {},
    sectionRowBody: { flex: 1, paddingRight: 8 },
    sectionRowTitle: { fontSize: 16, fontWeight: "700", color: t.text },
    sectionRowSub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: t.textSecondary, lineHeight: 18 },
    chevron: { fontSize: 22, fontWeight: "700", color: t.accentBlue },
    dangerText: { color: t.danger },
    dangerSub: { color: "rgba(239, 68, 68, 0.75)" },
    rowDivider: {
      position: "absolute",
      left: t.space.sm,
      right: t.space.sm,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border
    },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: t.space.sm,
      position: "relative"
    },
    settingsIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(96, 165, 250, 0.18)" : "rgba(59, 130, 246, 0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12
    },
    settingsIcon: { fontSize: 18 },
    settingsRowText: { flex: 1, paddingRight: 8 },
    settingsRowTitle: { fontSize: 16, fontWeight: "700", color: t.text },
    settingsRowSub: { marginTop: 3, fontSize: 13, fontWeight: "600", color: t.textMuted, lineHeight: 17 },
    settingsChevron: { fontSize: 20, color: t.textMuted, fontWeight: "600" },
    boolRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4
    },
    boolLabel: { flex: 1, fontSize: 16, fontWeight: "700", color: t.text, paddingRight: 12 },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 8
    },
    optionRowSelected: { backgroundColor: isDark ? "rgba(96, 165, 250, 0.18)" : "rgba(59, 130, 246, 0.12)" },
    optionLabel: { fontSize: 16, fontWeight: "700", color: t.text },
    optionLabelSelected: { color: t.accentBlue },
    optionCheck: { fontSize: 18, fontWeight: "900", color: t.accentBlue },
    saveBtn: {
      marginTop: t.space.md,
      backgroundColor: t.accentPurple,
      borderRadius: t.radius.pill,
      paddingVertical: 16,
      alignItems: "center"
    },
    saveBtnDanger: { backgroundColor: t.danger },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    saveBtnTextDanger: { color: "#fff" },
    modalRoot: { flex: 1, justifyContent: "center", padding: 24 },
    modalScrimAndroid: { backgroundColor: "rgba(15, 23, 42, 0.55)" },
    modalCard: {
      backgroundColor: t.bg,
      borderRadius: 20,
      padding: t.space.sm,
      borderWidth: 1,
      borderColor: t.border
    },
    modalTitle: { fontSize: 20, fontWeight: "900", color: t.text },
    modalBody: { marginTop: 10, fontSize: 15, fontWeight: "600", color: t.textSecondary, lineHeight: 22 },
    modalActions: { marginTop: 18, gap: 10 },
    modalBtnGhost: {
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 14,
      alignItems: "center"
    },
    modalBtnGhostText: { fontSize: 15, fontWeight: "700", color: t.text },
    modalBtnPrimary: {
      borderRadius: t.radius.pill,
      backgroundColor: t.accentPurple,
      paddingVertical: 14,
      alignItems: "center"
    },
    modalBtnDanger: { backgroundColor: t.danger },
    modalBtnPrimaryText: { fontSize: 15, fontWeight: "800", color: "#fff" }
  });
}

export function HubSpaceBanner(props: { title: string; subtitle: string }) {
  const { colors: t } = useAppTheme();
  return (
    <View style={{ marginBottom: t.space.sm }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: t.accentPurple,
          letterSpacing: 0.8,
          textTransform: "uppercase"
        }}
      >
        {props.title}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 14, fontWeight: "600", color: t.textSecondary, lineHeight: 20 }}>
        {props.subtitle}
      </Text>
    </View>
  );
}

export function ProfileHeader(props: {
  user: AuthUser | null;
  venueName?: string;
  streakScore?: string;
  showStreak?: boolean;
  avatarUri: string | null;
  onAvatarPress: () => void;
  onSwitchAccount?: () => void;
}) {
  const styles = useProfileStyles();
  const firstName = profileFirstName(props.user);
  const streak = props.streakScore ?? "4.98";
  const showStreak = props.showStreak ?? true;
  const venue = props.venueName?.trim();

  return (
    <View style={styles.profileHero}>
      <View style={styles.profileHeroBorder}>
        <View style={styles.profileHeroTopRow}>
          <View style={styles.profileIdentityCol}>
            <Pressable
              onPress={props.onAvatarPress}
              accessibilityRole="button"
              accessibilityLabel="View profile photo"
              style={styles.profileAvatarRing}
            >
              <View style={styles.profileAvatarInner}>
                {props.avatarUri ? (
                  <Image source={{ uri: props.avatarUri }} style={styles.profileAvatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.profileAvatarInitial}>{profileInitial(props.user)}</Text>
                )}
              </View>
            </Pressable>
            <Text style={styles.profileFirstName}>{firstName}</Text>
          </View>
          <View style={styles.profileRightCol}>
            {props.onSwitchAccount ? (
              <Pressable
                onPress={() => props.onSwitchAccount?.()}
                accessibilityRole="button"
                accessibilityLabel="Switch account"
                style={({ pressed }) => [styles.switchAccountBtn, pressed && styles.pressed]}
              >
                <Text style={styles.switchAccountText}>Switch Account</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {showStreak || venue ? (
          <View style={styles.profileMetaRow}>
            {showStreak ? (
              <View style={styles.profileRatingRow}>
                <Text style={styles.profileRatingStar} accessibilityLabel="User rating">
                  ★
                </Text>
                <Text style={styles.profileRatingValue}>{streak}</Text>
              </View>
            ) : (
              <View />
            )}
            {venue ? (
              <Text style={styles.profileVenueMeta} numberOfLines={2}>
                {venue}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function controlCentreChipVariant(
  action: ControlCentreChipManifest["action"]
): "help" | "safety" | "settings" {
  if (action === "navigate_safety") return "safety";
  if (action === "navigate_settings") return "settings";
  return "help";
}

export function ProfileQuickActionChips(props: {
  chips: ControlCentreChipManifest[];
  onChipPress: (chip: ControlCentreChipManifest) => void;
}) {
  const styles = useProfileStyles();
  if (props.chips.length === 0) return null;

  return (
    <View style={styles.profileQuickChipsRow}>
      {props.chips.map((chip) => (
        <TopChip
          key={chip.id}
          variant={controlCentreChipVariant(chip.action)}
          label={chip.label}
          highlightKey={chip.id as ProfileNavHighlightKey}
          onPress={() => props.onChipPress(chip)}
        />
      ))}
    </View>
  );
}

export function ProfileCard(props: { children: React.ReactNode; style?: StyleProp<ViewStyle>; noPad?: boolean }) {
  const styles = useProfileStyles();
  return (
    <View style={[styles.card, props.noPad && styles.cardNoPad, props.style]}>
      {props.children}
    </View>
  );
}

export function ProfileScreenContainer(props: {
  children: React.ReactNode;
  topInset: number;
  bottomInset: number;
  scrollEnabled?: boolean;
  scrollRefExternal?: React.RefObject<ScrollView | null>;
  onScrollOffset?: (y: number) => void;
  /** App control center: blur + sharp multi-stop glass scrims on scroll edges. */
  frostedScrollEdges?: boolean;
  /** Height of chrome above scroll body (top bar) — top glass extends upward by this amount. */
  frostedTopBleed?: number;
  /** Top glass rendered on menu stack (screen top → back row). */
  frostedExternalTopChrome?: boolean;
  onScrollEdges?: (edges: { atTop: boolean; atBottom: boolean }) => void;
}) {
  const styles = useProfileStyles();
  const { colors: t, isDark } = useAppTheme();
  const reportBottomNavScrollY = useBottomNavScrollReporter();
  const frostedBase = t.menuGradient[0];
  const internalScrollRef = React.useRef<ScrollView | null>(null);
  const scrollRef = props.scrollRefExternal ?? internalScrollRef;
  const [atTop, setAtTop] = React.useState(true);
  const [atBottom, setAtBottom] = React.useState(false);

  const handleScroll = React.useCallback((e: any) => {
    const y = Math.max(0, Number(e?.nativeEvent?.contentOffset?.y ?? 0));
    const h = Math.max(0, Number(e?.nativeEvent?.layoutMeasurement?.height ?? 0));
    const ch = Math.max(0, Number(e?.nativeEvent?.contentSize?.height ?? 0));
    const bottomGap = Math.max(0, ch - (y + h));
    const nextTop = y <= 2;
    const nextBottom = bottomGap <= 2;
    setAtTop(nextTop);
    setAtBottom(nextBottom);
    props.onScrollOffset?.(y);
    props.onScrollEdges?.({ atTop: nextTop, atBottom: nextBottom });
    reportBottomNavScroll(reportBottomNavScrollY, e);
  }, [props.onScrollEdges, props.onScrollOffset, reportBottomNavScrollY]);

  const topFadeOpacity = React.useRef(new Animated.Value(0)).current;
  const bottomFadeOpacity = React.useRef(new Animated.Value(0)).current;

  const fadeMs = props.frostedScrollEdges ? 160 : 220;

  React.useEffect(() => {
    Animated.timing(topFadeOpacity, {
      toValue: atTop ? 0 : 1,
      duration: fadeMs,
      useNativeDriver: true
    }).start();
  }, [atTop, topFadeOpacity, fadeMs]);

  React.useEffect(() => {
    Animated.timing(bottomFadeOpacity, {
      // Control center: bottom blur-dim only when (a) user has scrolled down and (b) there's content below.
      toValue: props.frostedScrollEdges ? (atBottom || atTop ? 0 : 1) : atBottom ? 0 : 1,
      duration: fadeMs,
      useNativeDriver: true
    }).start();
  }, [atBottom, atTop, bottomFadeOpacity, fadeMs, props.frostedScrollEdges]);

  const glassTop = isDark ? "rgba(11,18,32,0.0)" : "rgba(248,250,252,0.0)";
  const glassMid = isDark ? "rgba(11,18,32,0.62)" : "rgba(248,250,252,0.62)";
  const glassSolid = isDark ? "rgba(11,18,32,0.92)" : "rgba(248,250,252,0.92)";

  return (
    <View style={{ flex: 1, overflow: props.frostedScrollEdges ? "visible" : "hidden" }}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={props.scrollEnabled !== false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={[
          styles.screenPad,
          { paddingTop: props.topInset > 0 ? props.topInset : 8, paddingBottom: props.bottomInset + 24 }
        ]}
      >
        {props.children}
      </ScrollView>

      {props.frostedScrollEdges ? (
        <ProfileScrollFrostedEdges
          topOpacity={topFadeOpacity}
          bottomOpacity={bottomFadeOpacity}
          baseHex={frostedBase}
          isDark={isDark}
          topChromeHeight={props.frostedTopBleed}
          externalTopChrome={props.frostedExternalTopChrome}
        />
      ) : (
        <>
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: 28, opacity: topFadeOpacity }}
          >
            <LinearGradient
              colors={[glassSolid, glassMid, glassTop]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, opacity: bottomFadeOpacity }}
          >
            <LinearGradient
              colors={[glassTop, glassMid, glassSolid]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: isDark ? "rgba(0,0,0,0.08)" : "rgba(15,23,42,0.04)"
              }}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

export function TopChip(props: {
  variant: "help" | "safety" | "settings";
  label: string;
  onPress: () => void;
  highlightKey?: ProfileNavHighlightKey;
}) {
  const styles = useProfileStyles();
  const { colors: t } = useAppTheme();
  const { highlightKey } = useProfileNavHighlight();
  const active = Boolean(props.highlightKey && highlightKey === props.highlightKey);
  const iconColor = t.text;

  const icon =
    props.variant === "safety" ? (
      <ProfileChipIconSafety color={iconColor} />
    ) : props.variant === "settings" ? (
      <ProfileChipIconSettings color={iconColor} />
    ) : (
      <ProfileChipIconHelp color={iconColor} size={36} />
    );

  return (
    <NavHighlightWrap active={active} style={styles.topChipHighlightWrap}>
      <Pressable
        onPress={props.onPress}
        style={({ pressed }) => [styles.topChip, pressed && styles.pressed]}
      >
        <View style={styles.topChipIconWrap}>{icon}</View>
        <Text style={styles.topChipLabel}>{props.label}</Text>
      </Pressable>
    </NavHighlightWrap>
  );
}

export function SectionLabel(props: { children: string; variant?: "default" | "me" }) {
  const styles = useProfileStyles();
  return <Text style={props.variant === "me" ? styles.sectionLabelMe : styles.sectionLabel}>{props.children}</Text>;
}

export function SectionRow(props: {
  title: string;
  subtitle?: string;
  danger?: boolean;
  last?: boolean;
  onPress: () => void;
  highlightKey?: ProfileNavHighlightKey;
  noHighlight?: boolean;
}) {
  const styles = useProfileStyles();
  const { highlightKey } = useProfileNavHighlight();
  const active = Boolean(!props.noHighlight && props.highlightKey && highlightKey === props.highlightKey);

  const row = (
    <Pressable
      onPress={() => {
        props.onPress();
      }}
      style={({ pressed }) => [styles.sectionRow, pressed && styles.pressed, props.last && styles.sectionRowLast]}
    >
      <View style={styles.sectionRowBody}>
        <Text style={[styles.sectionRowTitle, props.danger && styles.dangerText]}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={[styles.sectionRowSub, props.danger && styles.dangerSub]}>{props.subtitle}</Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, props.danger && styles.dangerText]}>›</Text>
      {!props.last ? <View style={styles.rowDivider} /> : null}
    </Pressable>
  );

  if (!props.highlightKey) return row;

  return (
    <NavHighlightWrap active={active} style={styles.sectionRowHighlightWrap}>
      {row}
    </NavHighlightWrap>
  );
}

export function RowItem(props: {
  icon: string;
  title: string;
  subtitle: string;
  last?: boolean;
  onPress: () => void;
  highlightKey?: ProfileNavHighlightKey;
}) {
  const styles = useProfileStyles();
  const { highlightKey } = useProfileNavHighlight();
  const active = Boolean(props.highlightKey && highlightKey === props.highlightKey);

  const row = (
    <Pressable
      onPress={() => {
        props.onPress();
      }}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
    >
      <View style={styles.settingsIconBox}>
        <Text style={styles.settingsIcon}>{props.icon}</Text>
      </View>
      <View style={styles.settingsRowText}>
        <Text style={styles.settingsRowTitle}>{props.title}</Text>
        <Text style={styles.settingsRowSub} numberOfLines={2}>
          {props.subtitle}
        </Text>
      </View>
      <Text style={styles.settingsChevron}>›</Text>
      {!props.last ? <View style={styles.rowDivider} /> : null}
    </Pressable>
  );

  if (!props.highlightKey) return row;

  return (
    <NavHighlightWrap active={active} style={styles.sectionRowHighlightWrap}>
      {row}
    </NavHighlightWrap>
  );
}

export function BoolRow(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const styles = useProfileStyles();
  return (
    <View style={styles.boolRow}>
      <Text style={styles.boolLabel}>{props.label}</Text>
      <ThemedSwitch
        value={props.value}
        onValueChange={props.onChange}
      />
    </View>
  );
}

export function OptionRow(props: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useProfileStyles();
  return (
    <Pressable
      onPress={() => {
        props.onPress();
      }}
      style={({ pressed }) => [styles.optionRow, props.selected && styles.optionRowSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.optionLabel, props.selected && styles.optionLabelSelected]}>{props.label}</Text>
      {props.selected ? <Text style={styles.optionCheck}>✓</Text> : null}
    </Pressable>
  );
}

export function ProfilePrimaryButton(props: { label: string; onPress: () => void; danger?: boolean }) {
  const styles = useProfileStyles();
  return (
    <Pressable
      onPress={() => {
        hapticConfirm();
        props.onPress();
      }}
      style={({ pressed }) => [
        styles.saveBtn,
        props.danger && styles.saveBtnDanger,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.saveBtnText, props.danger && styles.saveBtnTextDanger]}>{props.label}</Text>
    </Pressable>
  );
}

/** Static wrapper — no entrance bounce/spring animation. */
export function FadeSection(props: { delay?: number; children: React.ReactNode }) {
  return <View>{props.children}</View>;
}

export function BlurModalScrim(props: {
  visible: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryDanger?: boolean;
}) {
  const styles = useProfileStyles();
  return (
    <Modal transparent visible={props.visible} animationType="fade" onRequestClose={props.onSecondary}>
      <View style={styles.modalRoot}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.modalScrimAndroid]} />
        )}
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{props.title}</Text>
          <Text style={styles.modalBody}>{props.body}</Text>
          <View style={styles.modalActions}>
            {props.secondaryLabel && props.onSecondary ? (
              <Pressable
                onPress={props.onSecondary}
                style={({ pressed }) => [styles.modalBtnGhost, pressed && styles.pressed]}
              >
                <Text style={styles.modalBtnGhostText}>{props.secondaryLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                hapticConfirm();
                props.onPrimary();
              }}
              style={({ pressed }) => [
                styles.modalBtnPrimary,
                props.primaryDanger && styles.modalBtnDanger,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.modalBtnPrimaryText}>{props.primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
