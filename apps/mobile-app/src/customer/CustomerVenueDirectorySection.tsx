import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";
import { patchCustomerPreferredRestaurant, type CustomerRestaurantRow } from "../api";
import { useAppTheme } from "../theme/AppThemeContext";
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
  token: string;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  changeDisabled?: boolean;
  /** When set, confirm UI is rendered by the parent (e.g. nav sheet shell). */
  onConfirmOverlayChange?: (node: React.ReactNode) => void;
};

export function CustomerVenueDirectorySection(props: CustomerVenueDirectorySectionProps) {
  const { userDisplayName, active, restaurants, token, onVenueHydrated, changeDisabled, onConfirmOverlayChange } =
    props;
  const { colors: t } = useAppTheme();
  const clock = useVenueClockTick(30000);
  const [moreActionsExpanded, setMoreActionsExpanded] = React.useState(false);
  const [venuesExpanded, setVenuesExpanded] = React.useState(false);
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
        foldSection: { marginTop: 16 },
        venuesSection: { marginTop: 10 },
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
        ghostRow: {
          borderRadius: 14,
          backgroundColor: t.bgElevated,
          borderWidth: 1,
          borderColor: t.border
        },
        ghostRowGap: { marginBottom: 8 },
        ghostRowInner: { paddingVertical: 12, paddingHorizontal: 14 },
        ghostLabel: { fontSize: 15, fontWeight: "700", color: t.text },
        ghostHint: { marginTop: 2, fontSize: 12, fontWeight: "600", color: t.textMuted },
        changeCta: {
          marginTop: 10,
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
        altHoursBlock: { marginTop: 4 },
        altHoursLine: { fontSize: 12, lineHeight: 17, fontWeight: "600", color: t.textSecondary },
        altHoursGap: { marginTop: 2 },
        altChevron: { fontSize: 18, fontWeight: "700", color: t.textMuted, marginLeft: 8 },
        pressed: { opacity: 0.9 },
        confirmHost: { ...StyleSheet.absoluteFillObject, zIndex: 20 }
      }),
    [t]
  );

  const alternatives = React.useMemo(
    () => restaurants.filter((r) => r.id !== active.id),
    [restaurants, active.id]
  );

  const activeHourLines = formatOpeningHoursLines(active.openingHours);
  const activeOpen = isVenueOpenNow(active.openingHours, clock);
  const currentVenueLabel = active.name.trim() || "Your current restaurant";

  function requestSwitch(r: CustomerRestaurantRow) {
    if (changeDisabled || confirmLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingSwitch({ id: r.id, name: r.name.trim() || "Selected restaurant" });
  }

  function cancelRestart() {
    setPendingSwitch(null);
    void Haptics.selectionAsync();
  }

  async function confirmRestart() {
    if (!pendingSwitch || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const patched = await patchCustomerPreferredRestaurant(token, pendingSwitch.id);
      if (!patched.ok) {
        setConfirmLoading(false);
        return;
      }
      await onVenueHydrated(patched.preferredRestaurantId);
      setPendingSwitch(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  function animateSections() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  function toggleMoreActions() {
    animateSections();
    setMoreActionsExpanded((e) => !e);
    void Haptics.selectionAsync();
  }

  function toggleVenuesSection() {
    if (changeDisabled || alternatives.length === 0) return;
    animateSections();
    setVenuesExpanded((e) => !e);
    void Haptics.selectionAsync();
  }

  function openVenuesFromChangeCta() {
    if (changeDisabled || alternatives.length === 0) return;
    animateSections();
    setMoreActionsExpanded(false);
    setVenuesExpanded(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  React.useEffect(() => {
    if (!onConfirmOverlayChange) return;
    if (!pendingSwitch) {
      onConfirmOverlayChange(null);
      return;
    }
    onConfirmOverlayChange(
      <VenueChangeRestartConfirmOverlay
        userFirstName={userDisplayName}
        currentVenueName={currentVenueLabel}
        nextVenueName={pendingSwitch.name}
        onCancel={cancelRestart}
        onConfirm={confirmRestart}
        loading={confirmLoading}
      />
    );
  }, [
    onConfirmOverlayChange,
    pendingSwitch,
    confirmLoading,
    userDisplayName,
    currentVenueLabel
  ]);

  if (!active.id.trim() && restaurants.length === 0) return null;

  return (
    <View>
      <Text style={styles.title} numberOfLines={2}>
        {currentVenueLabel}
      </Text>
      <Text style={[styles.statusTag, activeOpen ? styles.statusOpen : styles.statusClosed]}>
        {activeOpen ? "Open" : "Closed"}
      </Text>
      <Text style={styles.hoursLabel}>Opening hours</Text>
      <View style={styles.hoursBlock}>
        {activeHourLines.map((line, i) => (
          <Text key={`${i}-${line}`} style={[styles.hoursLine, i > 0 && styles.hoursLineGap]}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.divider} />

      <CollapsibleSection
        title="More actions"
        expanded={moreActionsExpanded}
        onToggle={toggleMoreActions}
        accessibilityHint="Shows optional venue actions"
        styles={styles}
      >
        <GhostActionRow
          label="Edit venue nickname"
          hint="Soon"
          onPress={() => void Haptics.selectionAsync()}
          styles={styles}
        />
        <GhostActionRow
          label="Mark as favorite"
          hint="Soon"
          onPress={() => void Haptics.selectionAsync()}
          styles={styles}
        />
        <GhostActionRow
          label="Notifications for this venue"
          hint="Soon"
          onPress={() => void Haptics.selectionAsync()}
          last
          styles={styles}
        />
      </CollapsibleSection>

      <Pressable
        onPress={openVenuesFromChangeCta}
        disabled={changeDisabled || alternatives.length === 0}
        style={({ pressed }) => [
          styles.changeCta,
          (changeDisabled || alternatives.length === 0) && styles.changeCtaDisabled,
          pressed && !changeDisabled && alternatives.length > 0 && styles.pressed
        ]}
      >
        <Text style={styles.changeCtaText}>Change restaurant</Text>
      </Pressable>

      {alternatives.length > 0 ? (
        <CollapsibleSection
          title="Other venues"
          expanded={venuesExpanded}
          onToggle={toggleVenuesSection}
          disabled={changeDisabled}
          accessibilityHint="Shows restaurants you can switch to"
          style={styles.venuesSection}
          styles={styles}
        >
          {alternatives.map((r) => {
            const lines = formatOpeningHoursLines(r.openingHours);
            const rowOpen = isVenueOpenNow(r.openingHours, clock);
            return (
              <Pressable
                key={r.id}
                disabled={!!pendingSwitch || confirmLoading}
                onPress={() => requestSwitch(r)}
                style={({ pressed }) => [styles.altRow, pressed && styles.pressed]}
              >
                <View style={styles.altRowText}>
                  <Text style={styles.altName}>{r.name}</Text>
                  <Text style={[styles.altOpenTag, rowOpen ? styles.statusOpen : styles.statusClosed]}>
                    {rowOpen ? "Open" : "Closed"}
                  </Text>
                  <View style={styles.altHoursBlock}>
                    {lines.map((line, i) => (
                      <Text key={`${r.id}-${i}-${line}`} style={[styles.altHoursLine, i > 0 && styles.altHoursGap]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>
                {pendingSwitch?.id === r.id && confirmLoading ? (
                  <ActivityIndicator color={t.accentPurple} />
                ) : (
                  <Text style={styles.altChevron}>→</Text>
                )}
              </Pressable>
            );
          })}
        </CollapsibleSection>
      ) : null}

      {!onConfirmOverlayChange && pendingSwitch ? (
        <View style={styles.confirmHost} pointerEvents="box-none">
          <VenueChangeRestartConfirmOverlay
            userFirstName={userDisplayName}
            currentVenueName={currentVenueLabel}
            nextVenueName={pendingSwitch.name}
            onCancel={cancelRestart}
            onConfirm={confirmRestart}
            loading={confirmLoading}
          />
        </View>
      ) : null}
    </View>
  );
}

type SectionStyles = ReturnType<typeof StyleSheet.create>;

function CollapsibleSection(props: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: object;
  styles: SectionStyles;
  children: React.ReactNode;
}) {
  const { title, expanded, onToggle, disabled, accessibilityHint, style, styles, children } = props;
  return (
    <View style={[styles.foldSection, style]}>
      <Pressable
        onPress={disabled ? undefined : onToggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.foldHeader,
          expanded && styles.foldHeaderExpanded,
          disabled && styles.foldHeaderDisabled,
          pressed && !disabled && styles.pressed
        ]}
      >
        <Text style={styles.foldTitle}>{title}</Text>
        <Text style={[styles.foldChevron, expanded && styles.foldChevronExpanded]}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded ? <View style={styles.foldBody}>{children}</View> : null}
    </View>
  );
}

function GhostActionRow(props: {
  label: string;
  hint: string;
  onPress: () => void;
  last?: boolean;
  styles: SectionStyles;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        props.styles.ghostRow,
        !props.last && props.styles.ghostRowGap,
        pressed && props.styles.pressed
      ]}
    >
      <View style={props.styles.ghostRowInner}>
        <Text style={props.styles.ghostLabel}>{props.label}</Text>
        <Text style={props.styles.ghostHint}>{props.hint}</Text>
      </View>
    </Pressable>
  );
}
