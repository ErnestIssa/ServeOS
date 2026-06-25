import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";
import { applyOrderEdit, customerCanEditOrder, fetchOrderDetail } from "../orderEngineApi";
import type { CustomerMineOrder } from "./CustomerOrderTrackingSection";

type Props = {
  visible: boolean;
  order: CustomerMineOrder;
  token: string;
  money: (cents: number) => string;
  onClose: () => void;
  onUpdated: () => void;
};

export function CustomerOrderEditSheet({ visible, order, token, money, onClose, onUpdated }: Props) {
  const { colors: t } = useAppTheme();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState(order.note ?? "");
  const [err, setErr] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const [lines, setLines] = React.useState<Array<{ id: string; name: string; quantity: number }>>([]);

  React.useEffect(() => {
    if (!visible) return;
    setNote(order.note ?? "");
    setErr(null);
    void (async () => {
      const res = await fetchOrderDetail(token, order.id);
      if (res.ok && res.order) {
        setVersion(res.order.version);
        setLines(
          res.order.lines.map((l) => ({ id: l.id, name: l.nameSnapshot, quantity: l.quantity }))
        );
      }
    })();
  }, [visible, order.id, order.note, token]);

  const editable = customerCanEditOrder({
    status: order.status,
    paymentStatus: (order as { paymentStatus?: string }).paymentStatus
  });

  async function saveNote() {
    setBusy(true);
    setErr(null);
    const res = await applyOrderEdit(token, order.id, {
      expectedVersion: version,
      operation: "UPDATE_NOTE",
      payload: { note }
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "Could not save note");
      return;
    }
    if (res.version != null) setVersion(res.version);
    onUpdated();
    onClose();
  }

  async function removeLine(lineId: string) {
    if (lines.length <= 1) {
      setErr("Cannot remove the only item");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await applyOrderEdit(token, order.id, {
      expectedVersion: version,
      operation: "REMOVE_ITEM",
      payload: { lineItemId: lineId }
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "Could not remove item");
      return;
    }
    if (res.version != null) setVersion(res.version);
    onUpdated();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.bgElevated }]}>
        <Text style={[styles.title, { color: t.text }]}>Edit order</Text>
        {!editable ? (
          <Text style={{ color: t.textMuted }}>
            This order can no longer be edited online. Contact the restaurant for changes.
          </Text>
        ) : (
          <>
            <Text style={[styles.label, { color: t.textMuted }]}>Kitchen note</Text>
            <TextInput
              style={[styles.input, { color: t.text, borderColor: t.border }]}
              value={note}
              onChangeText={setNote}
              multiline
              editable={!busy}
            />
            {lines.length > 0 ? (
              <View style={styles.lines}>
                <Text style={[styles.label, { color: t.textMuted }]}>Items</Text>
                {lines.map((l) => (
                  <View key={l.id} style={styles.lineRow}>
                    <Text style={{ color: t.text, flex: 1 }}>
                      {l.quantity}× {l.name}
                    </Text>
                    <Pressable disabled={busy} onPress={() => void removeLine(l.id)}>
                      <Text style={{ color: t.danger }}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Total {money(order.totalCents)}</Text>
            {err ? <Text style={{ color: t.danger }}>{err}</Text> : null}
            <Pressable
              style={[styles.btn, { backgroundColor: t.accentPurple }]}
              disabled={busy}
              onPress={() => void saveNote()}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
            </Pressable>
          </>
        )}
        <Pressable onPress={onClose} style={styles.cancel}>
          <Text style={{ color: t.textMuted }}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
    maxHeight: "70%"
  },
  title: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 72, textAlignVertical: "top" },
  lines: { gap: 8 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  cancel: { alignItems: "center", padding: 8 }
});
