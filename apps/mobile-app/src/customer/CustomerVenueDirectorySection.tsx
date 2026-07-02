import * as Haptics from "expo-haptics";
import React from "react";
import {
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";
import { patchCustomerPreferredRestaurant, type CustomerRestaurantRow } from "../api";
import { VenueEmptyCard } from "../components/VenueEmptyCard";
import { SkeletonVenueRows } from "../components/skeleton/SkeletonUi";
import { AdminNavChevron } from "../shell/AdminNavChevron";
import { useAppTheme } from "../theme/AppThemeContext";
import { formatApiError } from "./venueContentHelpers";
import { VenueChangeRestartConfirmOverlay } from "./VenueChangeRestartConfirmModal";
import { formatOpeningHoursLines } from "./venueHoursDisplay";
import { isVenueOpenNow, useVenueClockTick } from "./venueOpenNow";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type CustomerVenueDirectorySectionProps = {
  userDisplayName: string;
  active: { id: string; name: string; openingHours?: string | null };
  restaurants: CustomerRestaurantRow[];
  directoryLoading?: boolean;
  token: string;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  changeDisabled?: boolean;
  onSwitchError?: (message: string) => void;
  /** Borderless layout for the experience switcher sheet. */
  variant?: "default" | "experienceSheet" | "experienceModal";
  /** When set, confirm UI is rendered by the parent (e.g. nav sheet shell). */
  onConfirmOverlayChange?: (node: React.ReactNode) => void;
};

export function CustomerVenueDirectorySection(props: CustomerVenueDirectorySectionProps) {
  const {
    userDisplayName,
    active,
    restaurants,
    directoryLoading = false,
    token,
    onVenueHydrated,
    changeDisabled,
    onSwitchError,
    variant = "default",
    onConfirmOverlayChange
  } = props;
  const isSheet = variant === "experienceSheet";
  const isModal = variant === "experienceModal";
  const isCompactSheet = isSheet || isModal;
  const { colors: t, isDark } = useAppTheme();
  const clock = useVenueClockTick(30000);
  const activeIdAtMount = active.id.trim();
  const [venuesExpanded, setVenuesExpanded] = React.useState(
    () => isModal || !isCompactSheet || !activeIdAtMount
  );
  const [pendingSwitch, setPendingSwitch] = React.useState<{ id: string; name: string } | null>(null);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: { fontSize: 20, fontWeight: "900", color: t.text, letterSpacing: -0.3 },
        statusTag: {
          marginTop: 8,
          alignSelf: "flex-start",
          fontSize: 12,
          fontWeight: "800",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          overflow: "hidden"
        },
        statusOpen: { color: "#047857", backgroundColor: "rgba(16, 185, 129, 0.16)" },
        statusClosed: { color: "#B91C1C", backgroundColor: "rgba(239, 68, 68, 0.14)" },
        hoursLabel: {
          marginTop: 14,
          fontSize: 11,
          fontWeight: "800",
          color: t.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.6
        },
        hoursBlock: { marginTop: 6 },
        hoursLine: { fontSize: 14, lineHeight: 20, color: t.textSecondary, fontWeight: "600" },
        hoursLineGap: { marginTop: 4 },
        divider: {
          marginTop: 18,
          height: StyleSheet.hairlineWidth,
          backgroundColor: t.border
        },
        venuesSection: { marginTop: 16 },
        foldHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 13,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        foldHeaderExpanded: {
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderBottomWidth: 0
        },
        foldHeaderDisabled: { opacity: 0.45 },
        foldTitle: {
          fontSize: 11,
          fontWeight: "800",
          color: t.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.6
        },
        foldChevron: { fontSize: 12, fontWeight: "800", color: t.textMuted, marginLeft: 10 },
        foldChevronExpanded: { color: t.accentPurple },
        foldBody: {
          marginTop: 0,
          paddingTop: 8,
          paddingHorizontal: 2,
          paddingBottom: 4,
          borderWidth: 1,
          borderTopWidth: 0,
          borderColor: t.border,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          backgroundColor: t.bg
        },
        changeCta: {
          marginTop: 14,
          borderRadius: 16,
          paddingVertical: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.danger
        },
        changeCtaDisabled: { opacity: 0.38 },
        changeCtaText: { color: "#fff", fontSize: 16, fontWeight: "900" },
        altRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated,
          marginBottom: 8
        },
        altRowActive: { borderColor: t.accentPurple, backgroundColor: t.bgElevated },
        altRowText: { flex: 1, minWidth: 0 },
        altName: { fontSize: 16, fontWeight: "800", color: t.text },
        altOpenTag: {
          marginTop: 4,
          alignSelf: "flex-start",
          fontSize: 11,
          fontWeight: "800",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          overflow: "hidden"
        },
        altMeta: { marginTop: 4, fontSize: 12, fontWeight: "600", color: t.textMuted },
        altHoursBlock: { marginTop: 4 },
        altHoursLine: { fontSize: 12, lineHeight: 17, fontWeight: "600", color: t.textSecondary },
        altHoursGap: { marginTop: 2 },
        altChevron: { fontSize: 18, fontWeight: "700", color: t.textMuted, marginLeft: 8 },
        pressed: { opacity: 0.9 },
        confirmHost: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
        loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
        loadingText: { fontSize: 13, fontWeight: "600", color: t.textMuted },
        sheetSectionLabel: {
          flex: 1,
          fontSize: 22,
          fontWeight: "900",
          color: t.accentPurple,
          letterSpacing: -0.3
        },
        sheetTitleRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6
        },
        mapBtn: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        mapBtnText: {
          fontSize: 13,
          fontWeight: "800",
          color: t.text
        },
        sheetVenueName: {
          fontSize: 20,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.3
        },
        sheetFoldHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 10,
          paddingHorizontal: 0,
          minHeight: 44
        },
        sheetFoldTitle: {
          fontSize: 11,
          fontWeight: "800",
          color: t.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.7
        },
        sheetFoldBody: { paddingTop: 4, paddingBottom: 4 },
        sheetVenueRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 14,
          minHeight: 56,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated,
          marginBottom: 8
        },
        sheetVenueRowPressed: {
          backgroundColor: isDark ? "rgba(96, 165, 250, 0.14)" : "rgba(59, 130, 246, 0.1)",
          borderColor: t.accentBlue
        },
        sheetVenueRowPending: {
          borderColor: t.accentPurple,
          backgroundColor: isDark ? "rgba(167, 139, 250, 0.14)" : "rgba(139, 92, 246, 0.1)"
        },
        sheetVenueRowBorder: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        },
        changeCtaHint: {
          marginTop: 8,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "600",
          color: t.textMuted,
          textAlign: "center"
        },
        mapBtnDisabled: { opacity: 0.4 },
        modalSectionLabel: {
          flex: 1,
          fontSize: 13,
          fontWeight: "900",
          color: t.accentPurple,
          letterSpacing: -0.2
        },
        modalVenueName: {
          fontSize: 15,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.2
        },
        modalChangeCta: {
          marginTop: 8,
          borderRadius: 12,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.danger
        },
        modalChangeCtaText: { color: "#fff", fontSize: 12, fontWeight: "900" },
        modalVenueRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 9,
          paddingHorizontal: 10,
          minHeight: 42,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated,
          marginBottom: 6
        },
        modalMeta: { marginTop: 2, fontSize: 10, fontWeight: "600", color: t.textMuted, lineHeight: 14 },
        modalStatusTag: {
          marginTop: 4,
          alignSelf: "flex-start",
          fontSize: 10,
          fontWeight: "800",
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
          overflow: "hidden"
        },
        modalAltName: { fontSize: 13, fontWeight: "800", color: t.text },
        modalMapBtn: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated
        },
        modalMapBtnText: { fontSize: 11, fontWeight: "800", color: t.text },
        currentVenueCard: {
          marginTop: 6,
          marginBottom: 10,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: isDark ? "rgba(52,211,153,0.42)" : "rgba(16,185,129,0.38)",
          backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
          paddingHorizontal: 14,
          paddingVertical: 14,
          paddingTop: 16,
          position: "relative"
        },
        currentSticker: {
          position: "absolute",
          top: -1,
          right: 10,
          backgroundColor: "#10B981",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.9)",
          ...Platform.select({
            ios: {
              shadowColor: "#059669",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.22,
              shadowRadius: 4
            },
            android: { elevation: 3 }
          })
        },
        currentStickerText: {
          fontSize: 9,
          fontWeight: "900",
          color: "#fff",
          letterSpacing: 0.4,
          textTransform: "uppercase"
        }
      }),
    [isDark, t]
  );

  const activeId = active.id.trim();
  const selectable = React.useMemo(() => {
    if (!activeId) return restaurants;
    return restaurants.filter((r) => r.id !== activeId);
  }, [restaurants, activeId]);

  const activeInDirectory = React.useMemo(
    () => (activeId ? restaurants.find((r) => r.id === activeId) : undefined),
    [restaurants, activeId]
  );

  const activeHourLines = formatOpeningHoursLines(active.openingHours ?? activeInDirectory?.openingHours);
  const activeOpen = isVenueOpenNow(active.openingHours ?? activeInDirectory?.openingHours, clock);
  const currentVenueLabel = active.name.trim() || activeInDirectory?.name?.trim() || "Choose a venue";

  const venuesListTitle = activeId ? "Other venues" : "Our venues";
  const allVenuesForSheet = activeId ? selectable : restaurants;
  const collapsibleVenueCount = isCompactSheet ? allVenuesForSheet.length : selectable.length;

  const cancelRestart = React.useCallback(() => {
    setPendingSwitch(null);
    if (!isModal) void Haptics.selectionAsync();
  }, [isModal]);

  const pendingSwitchRef = React.useRef(pendingSwitch);
  pendingSwitchRef.current = pendingSwitch;

  const confirmSwitch = React.useCallback(async () => {
    const next = pendingSwitchRef.current;
    if (!next) return;
    setConfirmLoading(true);
    try {
      const patched = await patchCustomerPreferredRestaurant(token, next.id);
      if (!patched.ok) {
        onSwitchError?.(formatApiError(patched.error));
        setConfirmLoading(false);
        return;
      }
      await onVenueHydrated(patched.preferredRestaurantId);
      setPendingSwitch(null);
    } catch {
      onSwitchError?.("Could not switch venue. Try again.");
    } finally {
      setConfirmLoading(false);
    }
  }, [onSwitchError, onVenueHydrated, token]);

  function requestSwitch(r: CustomerRestaurantRow) {
    if (changeDisabled || confirmLoading) return;
    if (!isModal) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingSwitch({ id: r.id, name: r.name.trim() || "Selected venue" });
  }

  function toggleVenuesSection() {
    if (collapsibleVenueCount === 0) return;
    LayoutAnimation.configureNext(VENUE_SECTION_LAYOUT_ANIM);
    setVenuesExpanded((e) => !e);
    if (!isModal) void Haptics.selectionAsync();
  }

  function openVenuesFromChangeCta() {
    if (changeDisabled || collapsibleVenueCount === 0) return;
    LayoutAnimation.configureNext(VENUE_SECTION_LAYOUT_ANIM);
    setVenuesExpanded(true);
    if (!isModal) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const onConfirmOverlayChangeRef = React.useRef(onConfirmOverlayChange);
  onConfirmOverlayChangeRef.current = onConfirmOverlayChange;
  const cancelRestartRef = React.useRef(cancelRestart);
  cancelRestartRef.current = cancelRestart;
  const confirmSwitchRef = React.useRef(confirmSwitch);
  confirmSwitchRef.current = confirmSwitch;
  const overlaySignatureRef = React.useRef<string | null>(null);

  function openVenueMap() {
    if (!activeId) return;
    const query = encodeURIComponent(currentVenueLabel);
    if (!isModal) void Haptics.selectionAsync();
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  }

  React.useEffect(() => {
    const notify = onConfirmOverlayChangeRef.current;
    if (!notify || isSheet || isModal) return;

    if (!pendingSwitch) {
      if (overlaySignatureRef.current !== null) {
        overlaySignatureRef.current = null;
        notify(null);
      }
      return;
    }

    const currentName = activeId ? currentVenueLabel : "No venue selected";
    const signature = `${pendingSwitch.id}|${pendingSwitch.name}|${confirmLoading}|${currentName}|${userDisplayName}`;
    if (overlaySignatureRef.current === signature) return;
    overlaySignatureRef.current = signature;

    notify(
      <VenueChangeRestartConfirmOverlay
        userFirstName={userDisplayName}
        currentVenueName={currentName}
        nextVenueName={pendingSwitch.name}
        onCancel={() => cancelRestartRef.current()}
        onConfirm={() => void confirmSwitchRef.current()}
        loading={confirmLoading}
      />
    );
  }, [pendingSwitch, confirmLoading, userDisplayName, currentVenueLabel, activeId, isSheet, isModal]);

  function renderConfirmOverlay() {
    if (!pendingSwitch) return null;
    return (
      <VenueChangeRestartConfirmOverlay
        userFirstName={userDisplayName}
        currentVenueName={activeId ? currentVenueLabel : "No venue selected"}
        nextVenueName={pendingSwitch.name}
        onCancel={cancelRestart}
        onConfirm={confirmSwitch}
        loading={confirmLoading}
        hapticOnConfirm={isModal}
      />
    );
  }

  function renderConfirmHost() {
    if (!pendingSwitch) return null;
    if (isSheet || isModal) {
      return (
        <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={cancelRestart}>
          {renderConfirmOverlay()}
        </Modal>
      );
    }
    if (onConfirmOverlayChange) return null;
    return (
      <View style={styles.confirmHost} pointerEvents="box-none">
        {renderConfirmOverlay()}
      </View>
    );
  }

  if (directoryLoading && restaurants.length === 0) {
    return <SkeletonVenueRows count={4} style={{ marginTop: 12 }} />;
  }

  if (restaurants.length === 0) {
    return (
      <VenueEmptyCard
        title="No venues yet"
        message="When a venue registers on ServeOS, it will appear here so you can browse menus and place orders."
        style={isModal ? { marginTop: 2 } : isSheet ? { marginTop: 4 } : undefined}
      />
    );
  }

  function renderVenueRow(r: CustomerRestaurantRow, sheetRow: boolean, _isLast: boolean) {
    const lines = formatOpeningHoursLines(r.openingHours);
    const rowOpen = isVenueOpenNow(r.openingHours, clock);
    const isPending = pendingSwitch?.id === r.id;
    const rowDisabled = (pendingSwitch && !isPending) || confirmLoading || changeDisabled;
    const compact = isModal && sheetRow;
    return (
      <Pressable
        key={r.id}
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${r.name}`}
        accessibilityHint="Shows a confirmation before changing your venue"
        disabled={rowDisabled}
        onPress={() => requestSwitch(r)}
        android_ripple={sheetRow ? { color: isDark ? "rgba(96,165,250,0.2)" : "rgba(59,130,246,0.15)" } : undefined}
        style={({ pressed }) => [
          sheetRow ? (compact ? styles.modalVenueRow : styles.sheetVenueRow) : styles.altRow,
          sheetRow && isPending && styles.sheetVenueRowPending,
          !sheetRow && r.id === activeId && styles.altRowActive,
          pressed && !rowDisabled && (sheetRow ? styles.sheetVenueRowPressed : styles.pressed)
        ]}
      >
        <View style={styles.altRowText}>
          <Text style={compact ? styles.modalAltName : styles.altName} numberOfLines={1}>
            {r.name}
          </Text>
          <Text
            style={[
              compact ? styles.modalStatusTag : styles.altOpenTag,
              rowOpen ? styles.statusOpen : styles.statusClosed
            ]}
          >
            {rowOpen ? "Open" : "Closed"}
          </Text>
          {!compact && r.hasMenu === false ? <Text style={styles.altMeta}>Menu not published yet</Text> : null}
          {lines.length > 0 && !sheetRow ? (
            <View style={styles.altHoursBlock}>
              {lines.map((line, i) => (
                <Text key={`${r.id}-${i}-${line}`} style={[styles.altHoursLine, i > 0 && styles.altHoursGap]}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        {isPending && confirmLoading ? (
          <Text style={[styles.altChevron, compact && { fontSize: 15 }, { opacity: 0.45 }]}>→</Text>
        ) : (
          <Text style={[styles.altChevron, compact && { fontSize: 15 }]}>{sheetRow ? "›" : "→"}</Text>
        )}
      </Pressable>
    );
  }

  if (isCompactSheet) {
    const sectionTitle = activeId ? "Your venue" : "Choose a venue";
    return (
      <View>
        <View style={[styles.sheetTitleRow, isModal && { marginBottom: 2 }]}>
          <Text style={isModal ? styles.modalSectionLabel : styles.sheetSectionLabel}>{sectionTitle}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open venue in maps"
            disabled={!activeId}
            onPress={openVenueMap}
            style={({ pressed }) => [
              isModal ? styles.modalMapBtn : styles.mapBtn,
              !activeId && styles.mapBtnDisabled,
              pressed && activeId && styles.pressed
            ]}
          >
            <Text style={isModal ? styles.modalMapBtnText : styles.mapBtnText}>Map</Text>
          </Pressable>
        </View>
        {activeId ? (
          isModal ? (
            <View style={styles.currentVenueCard}>
              <View style={styles.currentSticker} pointerEvents="none">
                <Text style={styles.currentStickerText}>Current</Text>
              </View>
              <Text style={styles.modalVenueName} numberOfLines={2}>
                {currentVenueLabel}
              </Text>
              {!activeInDirectory ? (
                <Text style={[styles.modalMeta, { marginTop: 6 }]} numberOfLines={2}>
                  This venue is no longer available. Pick another from the list below.
                </Text>
              ) : (
                <Text
                  style={[
                    styles.modalStatusTag,
                    activeOpen ? styles.statusOpen : styles.statusClosed,
                    { marginTop: 6 }
                  ]}
                >
                  {activeOpen ? "Open" : "Closed"}
                </Text>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.sheetVenueName} numberOfLines={1}>
                {currentVenueLabel}
              </Text>
              {!activeInDirectory ? (
                <Text style={[styles.altMeta, { marginTop: 6 }]} numberOfLines={2}>
                  This venue is no longer available. Pick another from our venues below.
                </Text>
              ) : (
                <Text
                  style={[
                    styles.statusTag,
                    activeOpen ? styles.statusOpen : styles.statusClosed,
                    { marginTop: 8 }
                  ]}
                >
                  {activeOpen ? "Open" : "Closed"}
                </Text>
              )}
            </>
          )
        ) : (
          <Text style={[isModal ? styles.modalMeta : styles.altMeta, { marginTop: 2, marginBottom: isModal ? 2 : 4 }]} numberOfLines={2}>
            Select a registered venue to load menus, orders, and chat.
          </Text>
        )}

        {!isModal && activeId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change venue"
            onPress={openVenuesFromChangeCta}
            disabled={changeDisabled || selectable.length === 0}
            style={({ pressed }) => [
              styles.changeCta,
              changeDisabled && styles.changeCtaDisabled,
              pressed && !changeDisabled && styles.pressed
            ]}
          >
            <Text style={styles.changeCtaText}>Change venue</Text>
          </Pressable>
        ) : null}

        {!isModal ? (
          <Text style={styles.changeCtaHint}>
            Choose a venue below — you will confirm before anything changes.
          </Text>
        ) : null}

        {allVenuesForSheet.length > 0 ? (
          <CollapsibleSection
            title={venuesListTitle}
            expanded={venuesExpanded}
            onToggle={toggleVenuesSection}
            variant="sheet"
            styles={styles}
          >
            {allVenuesForSheet.map((r) => renderVenueRow(r, true, false))}
          </CollapsibleSection>
        ) : null}

        {renderConfirmHost()}
      </View>
    );
  }

  return (
    <View>
      {activeId ? (
        <>
          <Text style={styles.title} numberOfLines={2}>
            {currentVenueLabel}
          </Text>
          {!activeInDirectory ? (
            <Text style={[styles.altMeta, { marginTop: 8 }]}>
              This venue is no longer available. Choose another venue below.
            </Text>
          ) : null}
          <Text style={[styles.statusTag, activeOpen ? styles.statusOpen : styles.statusClosed]}>
            {activeOpen ? "Open" : "Closed"}
          </Text>
          {activeHourLines.length > 0 ? (
            <>
              <Text style={styles.hoursLabel}>Opening hours</Text>
              <View style={styles.hoursBlock}>
                {activeHourLines.map((line, i) => (
                  <Text key={`${i}-${line}`} style={[styles.hoursLine, i > 0 && styles.hoursLineGap]}>
                    {line}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
          <View style={styles.divider} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Choose a venue</Text>
          <Text style={[styles.altMeta, { marginTop: 8 }]}>
            Pick a registered ServeOS venue to load menus, orders, and chat.
          </Text>
          <View style={styles.divider} />
        </>
      )}

      {selectable.length > 0 ? (
        <>
          {!activeId ? null : (
            <Pressable
              onPress={openVenuesFromChangeCta}
              disabled={changeDisabled}
              style={({ pressed }) => [
                styles.changeCta,
                changeDisabled && styles.changeCtaDisabled,
                pressed && !changeDisabled && styles.pressed
              ]}
            >
              <Text style={styles.changeCtaText}>Change venue</Text>
            </Pressable>
          )}

          <CollapsibleSection
            title={activeId ? "Other venues" : "Our venues"}
            expanded={venuesExpanded}
            onToggle={toggleVenuesSection}
            disabled={changeDisabled}
            style={styles.venuesSection}
            styles={styles}
          >
            {selectable.map((r, i) => renderVenueRow(r, false, i === selectable.length - 1))}
          </CollapsibleSection>
        </>
      ) : null}

      {renderConfirmHost()}
    </View>
  );
}

type SectionStyles = ReturnType<typeof StyleSheet.create>;

const VENUE_SECTION_LAYOUT_ANIM = {
  duration: 280,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity
  }
};

function CollapsibleSection(props: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  variant?: "default" | "sheet";
  style?: object;
  styles: SectionStyles;
  children: React.ReactNode;
}) {
  const { colors: themeColors } = useAppTheme();
  const { title, expanded, onToggle, disabled, variant = "default", style, styles, children } = props;
  const isSheet = variant === "sheet";

  function handleToggle() {
    if (disabled) return;
    onToggle();
  }

  return (
    <View style={style}>
      <Pressable
        onPress={disabled ? undefined : handleToggle}
        disabled={disabled}
        hitSlop={isSheet ? { top: 8, bottom: 8, left: 0, right: 0 } : undefined}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [
          isSheet ? styles.sheetFoldHeader : styles.foldHeader,
          !isSheet && expanded && styles.foldHeaderExpanded,
          !isSheet && disabled && styles.foldHeaderDisabled,
          pressed && !disabled && styles.pressed
        ]}
      >
        <Text style={isSheet ? styles.sheetFoldTitle : styles.foldTitle}>{title}</Text>
        <AdminNavChevron
          open={expanded}
          color={expanded ? themeColors.accentPurple : themeColors.textMuted}
          size={14}
        />
      </Pressable>
      {expanded ? (
        <View style={isSheet ? styles.sheetFoldBody : styles.foldBody}>{children}</View>
      ) : null}
    </View>
  );
}
