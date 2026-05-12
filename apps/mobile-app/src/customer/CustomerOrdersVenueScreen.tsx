import React from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  fetchCustomerRestaurantDirectory,
  patchCustomerPreferredRestaurant,
  type CustomerRestaurantRow
} from "../api";
import { R } from "../theme";

type Props = {
  token: string;
  /** Venue currently driving menus & cart across the app. */
  activeId: string;
  activeName: string;
  demoMode: boolean;
  /** Persist new venue everywhere (menus, cart, profile). Caller may bump keys / reload shell. */
  onVenueHydrated: (restaurantId: string) => Promise<void>;
};

export function CustomerOrdersVenueScreen(props: Props) {
  const { token, activeId, activeName, demoMode, onVenueHydrated } = props;
  const [rows, setRows] = React.useState<CustomerRestaurantRow[] | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string>(activeId);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPendingId(activeId || "");
  }, [activeId]);

  React.useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    setLoadErr(null);
    void (async () => {
      const res = await fetchCustomerRestaurantDirectory(token);
      if (cancelled) return;
      if (!res.ok) {
        setRows([]);
        setLoadErr(typeof res.error === "string" ? res.error : "directory_failed");
        return;
      }
      setRows(res.restaurants);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, demoMode]);

  const hasChange = pendingId.trim() !== activeId.trim();

  async function onSave() {
    const rid = pendingId.trim();
    if (!rid || !hasChange || saving || demoMode) return;
    Keyboard.dismiss();
    setNotice(null);
    setSaving(true);
    const patched = await patchCustomerPreferredRestaurant(token, rid);
    if (!patched.ok) {
      setSaving(false);
      setNotice(patched.error ?? "Could not save venue");
      return;
    }
    try {
      await onVenueHydrated(patched.preferredRestaurantId);
      setNotice("Saved. Reloading your session for this venue…");
    } catch {
      setNotice("Saved on the server, but refresh failed. Try signing out and back in.");
    } finally {
      setSaving(false);
    }
  }

  if (demoMode) {
    return (
      <View style={styles.inset}>
        <Text style={styles.pageTitle}>Orders</Text>
        <Text style={styles.pageSub}>Demo menu mode — venue is fixed for design preview.</Text>
        <View style={[styles.cardShell, styles.heroCard]}>
          <Text style={styles.nowLabel}>Current venue</Text>
          <Text style={styles.venueName}>{activeName || "Demo venue"}</Text>
          <Text style={styles.mono}>{activeId || "—"}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inset}>
      <Text style={styles.pageTitle}>Orders</Text>
      <Text style={styles.pageSub}>
        Your account is scoped to one restaurant at a time. Pick a venue below, save, and the app reloads menus and your
        cart for that place only.
      </Text>

      <View style={[styles.cardShell, styles.heroCard]}>
        <Text style={styles.nowLabel}>Ordering at</Text>
        <Text style={styles.venueName}>{activeName || (activeId ? "Loading name…" : "No venue yet")}</Text>
        {activeId ? <Text style={styles.mono}>{activeId}</Text> : null}
        <Text style={styles.hintMuted}>Tap another venue in the list, then save to switch.</Text>
      </View>

      {loadErr ? <Text style={styles.warn}>{loadErr}</Text> : null}
      {rows === null ? (
        <View style={styles.loader}>
          <ActivityIndicator color={R.accentPurple} />
          <Text style={styles.loaderCap}>Loading venues…</Text>
        </View>
      ) : rows.length === 0 && !loadErr ? (
        <Text style={styles.warn}>No restaurants are available yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows!.map((r) => {
            const selected = pendingId === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  setNotice(null);
                  setPendingId(r.id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && styles.pressed
                ]}
              >
                <View style={styles.radioOuter}>{selected ? <View style={styles.radioInner} /> : null}</View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  <Text style={styles.rowId}>{r.id}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.pillPrimary,
          (!hasChange || saving || !pendingId.trim()) && styles.pillDisabled,
          pressed && styles.pressed
        ]}
        disabled={!hasChange || saving || !pendingId.trim()}
        onPress={() => void onSave()}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.pillPrimaryText}>Save &amp; apply venue</Text>
        )}
      </Pressable>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inset: { paddingHorizontal: 4 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: R.text, letterSpacing: -0.5 },
  pageSub: { marginTop: 8, fontSize: 15, lineHeight: 22, color: R.textMuted },
  cardShell: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: R.border,
    backgroundColor: R.bgElevated
  },
  heroCard: { padding: 18, marginTop: 20 },
  nowLabel: { fontSize: 12, fontWeight: "600", color: R.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  venueName: { marginTop: 6, fontSize: 22, fontWeight: "700", color: R.text },
  mono: { marginTop: 6, fontSize: 11, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), color: R.textMuted },
  hintMuted: { marginTop: 12, fontSize: 14, lineHeight: 20, color: R.textMuted },
  loader: { marginTop: 24, alignItems: "center" },
  loaderCap: { marginTop: 10, fontSize: 13, color: R.textMuted },
  list: { marginTop: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: R.border,
    backgroundColor: R.bgElevated
  },
  rowSelected: { borderColor: R.accentPurple, backgroundColor: "rgba(139, 92, 246, 0.08)" },
  pressed: { opacity: 0.92 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: R.accentPurple,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: R.accentPurple
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: "600", color: R.text },
  rowId: { marginTop: 2, fontSize: 11, color: R.textMuted },
  pillPrimary: {
    marginTop: 22,
    backgroundColor: R.accentPurple,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  pillDisabled: { opacity: 0.45 },
  pillPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  warn: { marginTop: 12, fontSize: 14, color: R.danger },
  notice: { marginTop: 14, fontSize: 14, lineHeight: 20, color: R.textMuted }
});
