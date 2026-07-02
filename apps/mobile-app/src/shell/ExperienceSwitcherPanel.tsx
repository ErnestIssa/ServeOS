import * as Haptics from "expo-haptics";
import React from "react";
import {
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
import { ExperienceSwitchConfirmModal } from "./ExperienceSwitchConfirmModal";
import {
  buildModalGuidance,
  currentModeLabel,
  hasAlternativeExperiences,
  listAlternativeExperiences,
  modalTitle,
  type ExperienceOption
} from "./experienceSwitcherUtils";
import { SkeletonVenueRows } from "../components/skeleton/SkeletonUi";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  variant?: "sheet" | "modal";
  /** When false, modal-scoped UI state is cleared (experience switcher modal). */
  modalOpen?: boolean;
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
};

export function ExperienceSwitcherPanel(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { switcher, busy, authToken, variant = "sheet", modalOpen = true } = props;
  const isModal = variant === "modal";
  const silentUi = isModal;
  const [experienceConfirmOpen, setExperienceConfirmOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [inviteInput, setInviteInput] = React.useState("");
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [directoryRows, setDirectoryRows] = React.useState<CustomerRestaurantRow[] | null>(null);
  const [directoryErr, setDirectoryErr] = React.useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = React.useState(false);
  const [directoryRetryTick, setDirectoryRetryTick] = React.useState(0);
  const aid = props.activeVenueId.trim();
  const canSwitchExperience = hasAlternativeExperiences(switcher);
  const experienceAlternatives = React.useMemo(() => listAlternativeExperiences(switcher), [switcher]);
  const modalGuidance = buildModalGuidance(switcher, Boolean(aid));
  const panelTitle = modalTitle(switcher);

  const resetModalUiState = React.useCallback(() => {
    setExperienceConfirmOpen(false);
    setJoinOpen(false);
    setInviteInput("");
    setJoinError(null);
    setJoinBusy(false);
  }, []);

  React.useEffect(() => {
    if (!isModal) return;
    if (!modalOpen) resetModalUiState();
  }, [isModal, modalOpen, resetModalUiState]);

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
          minHeight: isModal ? 0 : 120,
          backgroundColor: isModal ? "transparent" : isDark ? t.bgElevated : "rgba(255,255,255,0.94)"
        },
        scrollContent: {
          paddingTop: isModal ? 2 : 8,
          paddingHorizontal: isModal ? R.space.md : R.space.sm,
          paddingBottom: isModal ? Math.max(insets.bottom, 16) + 24 : Math.max(insets.bottom, 12) + 56
        },
        modalBody: {
          flex: 1,
          minHeight: 0,
          paddingHorizontal: R.space.md,
          justifyContent: "space-between"
        },
        modalMain: {
          flex: 1,
          minHeight: 0,
          justifyContent: "flex-start"
        },
        modalFooterDock: {
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 10) + 6,
          gap: 8
        },
        heroTitle: {
          fontSize: isModal ? 17 : 26,
          fontWeight: "900",
          color: t.text,
          letterSpacing: isModal ? -0.3 : -0.5,
          marginBottom: isModal ? 4 : 10
        },
        loginHint: {
          fontSize: isModal ? 11 : 13,
          lineHeight: isModal ? 16 : 20,
          fontWeight: "600",
          color: t.textMuted,
          marginBottom: isModal ? 10 : 16
        },
        experienceModeCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: isModal ? 10 : 20,
          borderRadius: isModal ? 16 : 18,
          borderWidth: 2,
          borderColor: isDark ? "rgba(167,139,250,0.45)" : "rgba(139,92,246,0.35)",
          backgroundColor: isDark ? "rgba(167,139,250,0.08)" : "rgba(139,92,246,0.06)",
          paddingVertical: isModal ? 13 : 16,
          paddingHorizontal: isModal ? 14 : 16
        },
        experienceModeCardStatic: {
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        experienceModeTextBlock: { flex: 1, minWidth: 0 },
        experienceModeLabel: {
          fontSize: isModal ? 9 : 11,
          fontWeight: "800",
          letterSpacing: 0.7,
          textTransform: "uppercase",
          color: t.textMuted,
          marginBottom: isModal ? 3 : 4
        },
        experienceModeValue: {
          fontSize: isModal ? 14 : 17,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.2
        },
        experienceChevron: {
          fontSize: isModal ? 22 : 24,
          fontWeight: "300",
          color: t.textMuted,
          lineHeight: isModal ? 24 : 26,
          marginTop: -2
        },
        venueSectionGap: { marginTop: isModal ? 0 : 4 },
        joinPanel: {
          marginTop: isModal ? 6 : 12,
          marginBottom: isModal ? 0 : 14,
          gap: isModal ? 6 : 10
        },
        joinInput: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: isModal ? 11 : 14,
          paddingHorizontal: isModal ? 11 : 14,
          paddingVertical: Platform.OS === "ios" ? (isModal ? 9 : 12) : isModal ? 8 : 10,
          fontSize: isModal ? 13 : 15,
          color: t.text,
          backgroundColor: t.bg
        },
        joinError: { color: t.danger, fontSize: isModal ? 11 : 13, fontWeight: "600" },
        joinSubmit: {
          alignSelf: "flex-start",
          backgroundColor: t.accentPurple,
          paddingHorizontal: isModal ? 14 : 18,
          paddingVertical: isModal ? 8 : 11,
          borderRadius: isModal ? 11 : 14
        },
        joinSubmitText: { color: "#fff", fontWeight: "800", fontSize: isModal ? 12 : 14 },
        footerRow: {
          flexDirection: "row",
          gap: isModal ? 8 : 10,
          marginTop: isModal ? 0 : 8
        },
        footerBtn: {
          flex: 1,
          minHeight: isModal ? 44 : 52,
          borderRadius: isModal ? 14 : 16,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: isModal ? 8 : 12
        },
        footerBtnJoin: {
          backgroundColor: isDark ? "rgba(96, 165, 250, 0.18)" : "rgba(59, 130, 246, 0.12)",
          borderWidth: 1.5,
          borderColor: t.accentBlue
        },
        footerBtnCreate: {
          backgroundColor: t.accentPurple
        },
        footerBtnTextJoin: { color: t.accentBlue, fontSize: isModal ? 12 : 14, fontWeight: "900", textAlign: "center" },
        footerBtnTextCreate: { color: "#fff", fontSize: isModal ? 12 : 14, fontWeight: "900", textAlign: "center" },
        busyOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? "rgba(11,18,32,0.45)" : "rgba(255,255,255,0.5)",
          alignItems: "center",
          justifyContent: "center"
        },
        screenError: { marginBottom: isModal ? 6 : 12, minHeight: isModal ? 72 : 120 },
        pressed: { opacity: 0.9 }
      }),
    [insets.bottom, isDark, isModal, t]
  );

  const openCreateRestaurant = React.useCallback(() => {
    if (!silentUi) hapticSelect();
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
      if (!silentUi) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoinOpen(false);
      setInviteInput("");
      props.onJoined?.();
    } finally {
      setJoinBusy(false);
    }
  }, [authToken, inviteInput, props, silentUi]);

  function openExperienceConfirm() {
    if (!canSwitchExperience || busy) return;
    if (!silentUi) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExperienceConfirmOpen(true);
  }

  function applyExperienceChoice(option: ExperienceOption) {
    setExperienceConfirmOpen(false);
    if (option.kind === "CUSTOMER") {
      props.onSelectCustomer();
    } else {
      props.onSelectWorkspace(option.restaurantId);
    }
  }

  function renderCurrentModeRow() {
    if (!canSwitchExperience) return null;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch experience"
        accessibilityHint="Opens options for other experiences you can use"
        onPress={openExperienceConfirm}
        disabled={busy}
        style={({ pressed }) => [styles.experienceModeCard, pressed && styles.pressed]}
      >
        <View style={styles.experienceModeTextBlock}>
          <Text style={styles.experienceModeLabel}>Current mode</Text>
          <Text style={styles.experienceModeValue} numberOfLines={isModal ? 2 : 2}>
            {currentModeLabel(switcher)}
          </Text>
        </View>
        <Text style={styles.experienceChevron} accessibilityElementsHidden>
          ›
        </Text>
      </Pressable>
    );
  }

  function renderExperienceConfirmModal() {
    if (!canSwitchExperience) return null;
    return (
      <ExperienceSwitchConfirmModal
        visible={experienceConfirmOpen}
        options={experienceAlternatives}
        currentLabel={currentModeLabel(switcher)}
        busy={busy}
        onCancel={() => setExperienceConfirmOpen(false)}
        onConfirm={applyExperienceChoice}
      />
    );
  }

  function toggleJoinPanel() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setJoinOpen((v) => !v);
    if (!silentUi) hapticSelect();
  }

  function renderVenueSection() {
    if (!showVenueDirectory) return null;
    return (
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
        ) : directoryLoading && (directoryRows?.length ?? 0) === 0 ? (
          <SkeletonVenueRows count={3} />
        ) : (
          <CustomerVenueDirectorySection
            variant={isModal ? "experienceModal" : "experienceSheet"}
            userDisplayName={props.userDisplayName}
            active={modalActive}
            restaurants={directoryRows ?? []}
            directoryLoading={directoryLoading}
            token={authToken ?? ""}
            onVenueHydrated={props.onVenueHydrated}
            changeDisabled={props.venueSwitchLocked}
            onSwitchError={props.onVenueSwitchError}
          />
        )}
      </View>
    );
  }

  function renderJoinPanel() {
    if (!joinOpen) return null;
    return (
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
          <Text style={[styles.joinSubmitText, joinBusy && { opacity: 0.55 }]}>Accept invite</Text>
        </Pressable>
      </View>
    );
  }

  function renderFooterActions() {
    if (!switcher?.actions.canJoinRestaurant && !switcher?.actions.canCreateRestaurant) return null;
    return (
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
    );
  }

  if (isModal) {
    return (
      <View style={styles.shell}>
        <View style={styles.modalBody}>
          <View style={styles.modalMain}>
            <Text style={styles.heroTitle}>{panelTitle}</Text>
            <Text style={styles.loginHint} numberOfLines={3}>
              {modalGuidance}
            </Text>
            {renderCurrentModeRow()}
            {renderVenueSection()}
          </View>

          <View style={styles.modalFooterDock}>
            {renderJoinPanel()}
            {renderFooterActions()}
          </View>
        </View>

        {renderExperienceConfirmModal()}
        {busy ? <View style={styles.busyOverlay} pointerEvents="none" /> : null}
      </View>
    );
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
        <Text style={styles.heroTitle}>{panelTitle}</Text>
        <Text style={styles.loginHint}>{modalGuidance}</Text>
        {renderCurrentModeRow()}
        {renderVenueSection()}

        {switcher?.actions.canJoinRestaurant || switcher?.actions.canCreateRestaurant ? (
          <>
            {renderJoinPanel()}
            {renderFooterActions()}
          </>
        ) : null}
      </ScrollView>

      {renderExperienceConfirmModal()}
      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="auto" />
      ) : null}
    </View>
  );
}
