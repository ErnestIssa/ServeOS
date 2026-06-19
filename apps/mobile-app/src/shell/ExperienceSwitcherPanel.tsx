import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getClientConfig, readApiMessage } from "../bootstrap/clientConfig";
import { CustomerVenueDirectorySection } from "../customer/CustomerVenueDirectorySection";
import { getServeosDemoPublicMenu, SERVEOS_DEMO_RESTAURANT_ID } from "../customer/demoPeakModeMenu";
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
import { NavSheetScrollView } from "./NavSheetScrollView";

type Props = {
  authToken: string | null;
  switcher: ExperienceSwitcherPayload | null;
  busy?: boolean;
  userId?: string | null;
  userDisplayName: string;
  activeVenueId: string;
  activeVenueName: string;
  venueSwitchLocked?: boolean;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  onSelectCustomer: () => void;
  onSelectWorkspace: (restaurantId: string) => void;
  onJoined?: () => void;
};

export function ExperienceSwitcherPanel(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { switcher, busy, authToken } = props;
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [inviteInput, setInviteInput] = React.useState("");
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [directoryRows, setDirectoryRows] = React.useState<CustomerRestaurantRow[] | null>(null);
  const [directoryErr, setDirectoryErr] = React.useState<string | null>(null);
  const [directoryRetryTick, setDirectoryRetryTick] = React.useState(0);
  const [venueConfirmOverlay, setVenueConfirmOverlay] = React.useState<React.ReactNode>(null);

  const aid = props.activeVenueId.trim();

  React.useEffect(() => {
    if (!authToken) {
      setDirectoryRows(null);
      return;
    }
    let cancelled = false;
    setDirectoryErr(null);
    void (async () => {
      try {
        const list = await loadRestaurantDirectoryCached(authToken, props.userId, (cached) => {
          if (!cancelled) setDirectoryRows(cached);
        });
        if (!cancelled) setDirectoryRows(list);
      } catch {
        if (!cancelled) {
          setDirectoryRows([]);
          setDirectoryErr("directory_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, props.userId, directoryRetryTick]);

  const currentRow = React.useMemo(
    () => (directoryRows && aid ? directoryRows.find((r) => r.id === aid) : undefined),
    [directoryRows, aid]
  );

  const demoNameFallback =
    aid === SERVEOS_DEMO_RESTAURANT_ID
      ? String(getServeosDemoPublicMenu().restaurant.name ?? "Demo venue")
      : "Your venue";
  const displayVenueName = (currentRow?.name ?? props.activeVenueName).trim() || demoNameFallback;

  const modalActive = React.useMemo(
    () => ({
      id: aid,
      name: displayVenueName,
      openingHours: currentRow?.openingHours ?? null
    }),
    [aid, displayVenueName, currentRow?.openingHours]
  );

  const showVenueDirectory = Boolean(aid || (directoryRows && directoryRows.length > 0));

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        shell: {
          flex: 1,
          minHeight: 120,
          backgroundColor: isDark ? t.bgElevated : "rgba(255,255,255,0.94)"
        },
        scrollContent: {
          paddingTop: 16,
          paddingHorizontal: R.space.sm,
          paddingBottom: Math.max(insets.bottom, 12) + 18
        },
        title: { fontSize: 20, fontWeight: "900", color: t.text, marginBottom: 4 },
        subtitle: { fontSize: 13, fontWeight: "600", color: t.textMuted, marginBottom: 18 },
        sectionLabel: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.8,
          color: t.textMuted,
          marginTop: 12,
          marginBottom: 8
        },
        venueDivider: {
          marginTop: 20,
          marginBottom: 8,
          height: StyleSheet.hairlineWidth,
          backgroundColor: t.border
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bg,
          marginBottom: 8
        },
        rowSelected: { borderColor: t.accentPurple, backgroundColor: t.bgElevated },
        rowTitle: { fontSize: 16, fontWeight: "800", color: t.text },
        rowSub: { fontSize: 13, fontWeight: "600", color: t.textSecondary, marginTop: 2 },
        check: { fontSize: 16, fontWeight: "900", color: t.accentPurple },
        actionRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 14,
          paddingHorizontal: 4
        },
        actionText: { fontSize: 15, fontWeight: "800", color: t.accentPurple },
        joinBox: {
          marginTop: 8,
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bg
        },
        joinInput: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === "ios" ? 10 : 8,
          fontSize: 15,
          color: t.text,
          marginBottom: 10
        },
        joinError: { color: t.danger, fontSize: 13, fontWeight: "600", marginBottom: 8 },
        joinBtn: {
          alignSelf: "flex-start",
          backgroundColor: t.accentPurple,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 12
        },
        joinBtnText: { color: "#fff", fontWeight: "800" },
        busyOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? "rgba(11,18,32,0.45)" : "rgba(255,255,255,0.5)",
          alignItems: "center",
          justifyContent: "center"
        },
        confirmOverlayHost: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 30
        },
        screenError: { marginBottom: 12, minHeight: 120 }
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
      setJoinError("Sign in to join a restaurant.");
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

  return (
    <View style={styles.shell}>
      <NavSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Switch experience</Text>
        <Text style={styles.subtitle}>Same account — choose customer browsing or a restaurant workspace.</Text>

        {showVenueDirectory ? (
          <>
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
                userDisplayName={props.userDisplayName}
                active={modalActive}
                restaurants={directoryRows ?? []}
                token={authToken ?? ""}
                onVenueHydrated={props.onVenueHydrated}
                changeDisabled={props.venueSwitchLocked}
                onConfirmOverlayChange={setVenueConfirmOverlay}
              />
            )}
            <View style={styles.venueDivider} />
          </>
        ) : null}

        <Text style={styles.sectionLabel}>CUSTOMER</Text>
        <Pressable
          style={[styles.row, switcher?.customerMode.selected && styles.rowSelected]}
          onPress={() => {
            hapticSelect();
            props.onSelectCustomer();
          }}
          disabled={busy}
        >
          <View>
            <Text style={styles.rowTitle}>Customer mode</Text>
            <Text style={styles.rowSub}>Browse, order, reservations, profile</Text>
          </View>
          {switcher?.customerMode.selected ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>

        {switcher && switcher.workspaces.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>WORKSPACES</Text>
            {switcher.workspaces.map((w) => (
              <Pressable
                key={w.restaurantId}
                style={[styles.row, w.selected && styles.rowSelected]}
                onPress={() => {
                  hapticSelect();
                  props.onSelectWorkspace(w.restaurantId);
                }}
                disabled={busy}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {w.restaurantName}
                  </Text>
                  <Text style={styles.rowSub}>{w.roleLabel}</Text>
                </View>
                {w.selected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ))}
          </>
        ) : null}

        {switcher?.actions.canJoinRestaurant ? (
          <>
            <Pressable
              style={styles.actionRow}
              onPress={() => {
                hapticSelect();
                setJoinOpen((v) => !v);
              }}
            >
              <Text style={styles.actionText}>+ Join restaurant</Text>
            </Pressable>
            {joinOpen ? (
              <View style={styles.joinBox}>
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
                <Pressable style={styles.joinBtn} onPress={() => void submitJoin()} disabled={joinBusy}>
                  {joinBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.joinBtnText}>Accept invite</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {switcher?.actions.canCreateRestaurant ? (
          <Pressable style={styles.actionRow} onPress={openCreateRestaurant}>
            <Text style={styles.actionText}>+ Create restaurant</Text>
          </Pressable>
        ) : null}
      </NavSheetScrollView>

      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={t.accentPurple} />
        </View>
      ) : null}

      {venueConfirmOverlay ? (
        <View style={styles.confirmOverlayHost} pointerEvents="box-none">
          {venueConfirmOverlay}
        </View>
      ) : null}
    </View>
  );
}
