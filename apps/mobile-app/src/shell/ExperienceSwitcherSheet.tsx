import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getClientConfig, readApiMessage } from "../bootstrap/clientConfig";
import { hapticSelect } from "../customer/profile/ProfileUi";
import {
  acceptWorkspaceInvite,
  extractInviteToken,
  type ExperienceSwitcherPayload
} from "../mobile/experienceSwitcherApi";
import { useAppTheme } from "../theme/AppThemeContext";

const STORE_ICON = require("../../assets/store.png");

type Props = {
  visible: boolean;
  authToken: string | null;
  switcher: ExperienceSwitcherPayload | null;
  busy?: boolean;
  onClose: () => void;
  onSelectCustomer: () => void;
  onSelectWorkspace: (restaurantId: string) => void;
  onJoined?: () => void;
};

export function ExperienceSwitcherSheet(props: Props) {
  const { colors: t } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { visible, switcher, busy, authToken } = props;
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [inviteInput, setInviteInput] = React.useState("");
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [joinError, setJoinError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setJoinOpen(false);
      setInviteInput("");
      setJoinError(null);
    }
  }, [visible]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        scrim: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
        sheet: {
          backgroundColor: t.bgElevated,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          maxHeight: "88%"
        },
        handle: {
          alignSelf: "center",
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: t.border,
          marginBottom: 16
        },
        titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
        title: { fontSize: 20, fontWeight: "900", color: t.text },
        subtitle: { fontSize: 13, fontWeight: "600", color: t.textMuted, marginBottom: 18 },
        sectionLabel: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.8,
          color: t.textMuted,
          marginTop: 12,
          marginBottom: 8
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
          paddingVertical: 10,
          fontSize: 15,
          color: t.text,
          marginBottom: 10
        },
        joinError: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 8 },
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
          backgroundColor: "rgba(255,255,255,0.5)",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 24
        }
      }),
    [insets.bottom, t]
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

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.scrim} onPress={props.onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Image source={STORE_ICON} style={{ width: 24, height: 24 }} resizeMode="contain" />
            <Text style={styles.title}>Switch experience</Text>
          </View>
          <Text style={styles.subtitle}>Same account — choose customer browsing or a restaurant workspace.</Text>

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

          {busy ? (
            <View style={styles.busyOverlay} pointerEvents="none">
              <ActivityIndicator color={t.accentPurple} />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
