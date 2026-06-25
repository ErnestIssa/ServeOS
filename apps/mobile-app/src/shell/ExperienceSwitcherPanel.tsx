import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getClientConfig, readApiMessage } from "../bootstrap/clientConfig";
import { CustomerVenueDirectorySection } from "../customer/CustomerVenueDirectorySection";
import { hapticSelect } from "../customer/profile/ProfileUi";
import { loadRestaurantDirectoryCached } from "../data/customerDataCache";
import { ScreenErrorState, formatAppError } from "../errors";
import type { CustomerRestaurantRow } from "../api";
import {
  acceptWorkspaceInvite,
  extractInviteToken,
  type ExperienceSwitcherPayload
} from "../mobile/experienceSwitcherApi";
import { useAppTheme } from "../theme/AppThemeContext";
import { R } from "../theme";
import { ScrollView } from "react-native-gesture-handler";
import { AdminNavChevron } from "./AdminNavChevron";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  authToken: string | null;
  switcher: ExperienceSwitcherPayload | null;
  busy?: boolean;
  userId?: string | null;
  userDisplayName: string;
  userEmail?: string | null;
  activeVenueId: string;
  activeVenueName: string;
  venueSwitchLocked?: boolean;
  directoryRefreshKey?: number;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  onVenueSwitchError?: (message: string) => void;
  onSelectCustomer: () => void;
  onSelectWorkspace: (restaurantId: string) => void;
  onJoined?: () => void;
  /** Full-screen venue switch confirm (rendered above the nav sheet in App). */
  onVenueConfirmOverlayChange?: (node: React.ReactNode) => void;
};

function currentModeLabel(switcher: ExperienceSwitcherPayload | null): string {
  if (!switcher) return "Customer mode";
  if (switcher.activeMode === "WORKSPACE" && switcher.activeWorkspace) {
    return `${switcher.activeWorkspace.restaurantName} · ${switcher.activeWorkspace.roleLabel}`;
  }
  return "Customer mode";
}

function formatExperienceList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function buildExperienceHint(switcher: ExperienceSwitcherPayload | null): string {
  const current = currentModeLabel(switcher);
  if (!switcher) {
    return `You are in ${current}. No other experiences are available yet.`;
  }

  const alternatives: string[] = [];
  if (switcher.activeMode === "CUSTOMER") {
    for (const w of switcher.workspaces) {
      alternatives.push(`${w.restaurantName} (${w.roleLabel})`);
    }
    if (alternatives.length === 0) {
      return `You are in ${current}. No other experiences are available yet.`;
    }
    return `You are in ${current}. You can switch to ${formatExperienceList(alternatives)}.`;
  }

  alternatives.push("customer mode");
  for (const w of switcher.workspaces) {
    if (!w.selected) {
      alternatives.push(`${w.restaurantName} (${w.roleLabel})`);
    }
  }
  return `You are in ${current}. You can switch to ${formatExperienceList(alternatives)}.`;
}

export function ExperienceSwitcherPanel(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { switcher, busy, authToken } = props;
  const [modePickerOpen, setModePickerOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [inviteInput, setInviteInput] = React.useState("");
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [directoryRows, setDirectoryRows] = React.useState<CustomerRestaurantRow[] | null>(null);
  const [directoryErr, setDirectoryErr] = React.useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = React.useState(false);
  const [directoryRetryTick, setDirectoryRetryTick] = React.useState(0);
  const aid = props.activeVenueId.trim();
  const experienceHint = buildExperienceHint(switcher);

  React.useEffect(() => {
    if (!authToken) {
      setDirectoryRows(null);
      setDirectoryLoading(false);
      return;
    }
    let cancelled = false;
    setDirectoryErr(null);
    setDirectoryLoading(true);
    void (async () => {
      try {
        const list = await loadRestaurantDirectoryCached(
          authToken,
          props.userId,
          (cached) => {
            if (!cancelled) setDirectoryRows(cached);
          },
          { force: (props.directoryRefreshKey ?? 0) > 0 }
        );
        if (!cancelled) setDirectoryRows(list);
      } catch {
        if (!cancelled) {
          setDirectoryRows([]);
          setDirectoryErr("directory_failed");
        }
      } finally {
        if (!cancelled) setDirectoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, props.userId, directoryRetryTick, props.directoryRefreshKey]);

  const currentRow = React.useMemo(
    () => (directoryRows && aid ? directoryRows.find((r) => r.id === aid) : undefined),
    [directoryRows, aid]
  );

  const displayVenueName = (currentRow?.name ?? props.activeVenueName).trim() || (aid ? "Your venue" : "No venue yet");

  const modalActive = React.useMemo(
    () => ({
      id: aid,
      name: displayVenueName,
      openingHours: currentRow?.openingHours ?? null
    }),
    [aid, displayVenueName, currentRow?.openingHours]
  );

  const showVenueDirectory = Boolean(authToken);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        shell: {
          flex: 1,
          minHeight: 120,
          backgroundColor: isDark ? t.bgElevated : "rgba(255,255,255,0.94)"
        },
        scrollContent: {
          paddingTop: 8,
          paddingHorizontal: R.space.sm,
          paddingBottom: Math.max(insets.bottom, 12) + 100
        },
        heroTitle: {
          fontSize: 26,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.5,
          marginBottom: 10
        },
        loginHint: {
          fontSize: 13,
          lineHeight: 20,
          fontWeight: "600",
          color: t.textMuted,
          marginBottom: 16
        },
        currentModeRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20
        },
        currentModeBlock: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
        currentModeTextBlock: { flex: 1, minWidth: 0 },
        currentModeLabel: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.7,
          textTransform: "uppercase",
          color: t.textMuted,
          marginBottom: 4
        },
        currentModeValue: {
          fontSize: 17,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.2
        },
        switchExperienceBtn: {
          borderRadius: 14,
          paddingVertical: 11,
          paddingHorizontal: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.danger,
          flexShrink: 0,
          maxWidth: 148
        },
        switchExperienceBtnText: {
          color: "#fff",
          fontSize: 12,
          fontWeight: "900",
          textAlign: "center",
          lineHeight: 16
        },
        modePicker: { marginTop: -4, marginBottom: 24, gap: 10 },
        modeRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 14,
          paddingHorizontal: 2
        },
        modeRowBorder: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        },
        modeRowTitle: { fontSize: 16, fontWeight: "800", color: t.text },
        modeRowSub: { fontSize: 13, fontWeight: "600", color: t.textMuted, marginTop: 3 },
        modeCheck: { fontSize: 15, fontWeight: "900", color: t.accentPurple },
        venueSectionGap: { marginTop: 4 },
        joinPanel: {
          marginTop: 12,
          marginBottom: 14,
          gap: 10
        },
        joinInput: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: Platform.OS === "ios" ? 12 : 10,
          fontSize: 15,
          color: t.text,
          backgroundColor: t.bg
        },
        joinError: { color: t.danger, fontSize: 13, fontWeight: "600" },
        joinSubmit: {
          alignSelf: "flex-start",
          backgroundColor: t.accentPurple,
          paddingHorizontal: 18,
          paddingVertical: 11,
          borderRadius: 14
        },
        joinSubmitText: { color: "#fff", fontWeight: "800", fontSize: 14 },
        footerRow: {
          flexDirection: "row",
          gap: 10,
          marginTop: 8
        },
        footerBtn: {
          flex: 1,
          minHeight: 52,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12
        },
        footerBtnJoin: {
          backgroundColor: isDark ? "rgba(96, 165, 250, 0.18)" : "rgba(59, 130, 246, 0.12)",
          borderWidth: 1.5,
          borderColor: t.accentBlue
        },
        footerBtnCreate: {
          backgroundColor: t.accentPurple
        },
        footerBtnTextJoin: { color: t.accentBlue, fontSize: 14, fontWeight: "900", textAlign: "center" },
        footerBtnTextCreate: { color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" },
        busyOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? "rgba(11,18,32,0.45)" : "rgba(255,255,255,0.5)",
          alignItems: "center",
          justifyContent: "center"
        },
        screenError: { marginBottom: 12, minHeight: 120 },
        pressed: { opacity: 0.9 }
      }),
    [insets.bottom, isDark, t]
  );

  const openCreateRestaurant = React.useCallback(() => {
    hapticSelect();
    const web = getClientConfig()?.urls.customerWeb?.replace(/\/$/, "");
    if (web) void Linking.openURL(`${web}/signup?experience=business`);
    else void Linking.openURL("https://serveos.app");
  }, []);

  const submitJoin = React.useCallback(async () => {
    const token = extractInviteToken(inviteInput);
    if (!token) {
      setJoinError("Enter an invite code or link.");
      return;
    }
    if (!authToken) {
      setJoinError("Sign in to join a venue.");
      return;
    }
    setJoinBusy(true);
    setJoinError(null);
    try {
      const res = await acceptWorkspaceInvite(authToken, token);
      if (!res.ok) {
        setJoinError(readApiMessage(res));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoinOpen(false);
      setInviteInput("");
      props.onJoined?.();
    } finally {
      setJoinBusy(false);
    }
  }, [authToken, inviteInput, props]);

  function toggleModePicker() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setModePickerOpen((v) => !v);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function toggleJoinPanel() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setJoinOpen((v) => !v);
    hapticSelect();
  }

  return (
    <View style={styles.shell}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroTitle}>Switch experience</Text>
        <Text style={styles.loginHint}>{experienceHint}</Text>

        <View style={styles.currentModeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: modePickerOpen }}
            accessibilityLabel={modePickerOpen ? "Hide experience options" : "Current experience mode"}
            onPress={modePickerOpen ? toggleModePicker : undefined}
            disabled={busy || !modePickerOpen}
            style={styles.currentModeBlock}
          >
            {modePickerOpen ? (
              <AdminNavChevron open color={t.accentPurple} size={14} />
            ) : null}
            <View style={styles.currentModeTextBlock}>
              <Text style={styles.currentModeLabel}>Current mode</Text>
              <Text style={styles.currentModeValue} numberOfLines={2}>
                {currentModeLabel(switcher)}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: modePickerOpen }}
            accessibilityLabel="Switch experience"
            onPress={toggleModePicker}
            disabled={busy}
            style={({ pressed }) => [styles.switchExperienceBtn, pressed && styles.pressed]}
          >
            <Text style={styles.switchExperienceBtnText}>Switch experience</Text>
          </Pressable>
        </View>

        {modePickerOpen ? (
          <View style={styles.modePicker}>
            <Pressable
              style={({ pressed }) => [
                styles.modeRow,
                styles.modeRowBorder,
                pressed && styles.pressed
              ]}
              onPress={() => {
                hapticSelect();
                props.onSelectCustomer();
              }}
              disabled={busy}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modeRowTitle}>Customer mode</Text>
                <Text style={styles.modeRowSub}>Browse, order, reservations</Text>
              </View>
              {switcher?.customerMode.selected ? <Text style={styles.modeCheck}>✓</Text> : null}
            </Pressable>

            {switcher?.workspaces.map((w) => (
              <Pressable
                key={w.restaurantId}
                style={({ pressed }) => [styles.modeRow, styles.modeRowBorder, pressed && styles.pressed]}
                onPress={() => {
                  hapticSelect();
                  props.onSelectWorkspace(w.restaurantId);
                }}
                disabled={busy}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modeRowTitle} numberOfLines={1}>
                    {w.restaurantName}
                  </Text>
                  <Text style={styles.modeRowSub}>{w.roleLabel}</Text>
                </View>
                {w.selected ? <Text style={styles.modeCheck}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {showVenueDirectory ? (
          <View style={styles.venueSectionGap}>
            {directoryErr ? (
              <ScreenErrorState
                title="Venues unavailable"
                message={formatAppError(directoryErr)}
                onRetry={() => {
                  setDirectoryErr(null);
                  setDirectoryRetryTick((n) => n + 1);
                }}
                style={styles.screenError}
              />
            ) : (
              <CustomerVenueDirectorySection
                variant="experienceSheet"
                userDisplayName={props.userDisplayName}
                active={modalActive}
                restaurants={directoryRows ?? []}
                directoryLoading={directoryLoading}
                token={authToken ?? ""}
                onVenueHydrated={props.onVenueHydrated}
                changeDisabled={props.venueSwitchLocked}
                onSwitchError={props.onVenueSwitchError}
                onConfirmOverlayChange={props.onVenueConfirmOverlayChange}
              />
            )}
          </View>
        ) : null}

        {switcher?.actions.canJoinRestaurant || switcher?.actions.canCreateRestaurant ? (
          <>
            {joinOpen ? (
              <View style={styles.joinPanel}>
                <TextInput
                  value={inviteInput}
                  onChangeText={setInviteInput}
                  placeholder="Invite code or link"
                  placeholderTextColor={t.textMuted}
                  style={styles.joinInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => void submitJoin()}
                />
                {joinError ? <Text style={styles.joinError}>{joinError}</Text> : null}
                <Pressable style={styles.joinSubmit} onPress={() => void submitJoin()} disabled={joinBusy}>
                  {joinBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.joinSubmitText}>Accept invite</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            <View style={styles.footerRow}>
              {switcher?.actions.canJoinRestaurant ? (
                <Pressable
                  style={({ pressed }) => [styles.footerBtn, styles.footerBtnJoin, pressed && styles.pressed]}
                  onPress={toggleJoinPanel}
                >
                  <Text style={styles.footerBtnTextJoin}>Join restaurant</Text>
                </Pressable>
              ) : null}
              {switcher?.actions.canCreateRestaurant ? (
                <Pressable
                  style={({ pressed }) => [styles.footerBtn, styles.footerBtnCreate, pressed && styles.pressed]}
                  onPress={openCreateRestaurant}
                >
                  <Text style={styles.footerBtnTextCreate}>Create restaurant</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={t.accentPurple} />
        </View>
      ) : null}
    </View>
  );
}
