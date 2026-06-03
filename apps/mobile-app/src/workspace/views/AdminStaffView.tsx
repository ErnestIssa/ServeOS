import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { approveStaffMembership, inviteStaffMember, rejectStaffMembership } from "../staffAccessApi";

type Props = {
  authToken: string;
  restaurantId: string;
  payload: {
    pendingApprovals: Array<{ membershipId: string; fullName: string | null; email: string | null; role: string }>;
    pendingInvitations: Array<{ id: string; fullName: string; email: string; intendedRole: string }>;
    members: Array<{ id: string; role: string; status: string; email: string | null }>;
    canInvite: boolean;
    canApprove: boolean;
  };
  onReload: () => void;
};

export function AdminStaffView(props: Props) {
  const { colors: t } = useAppTheme();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("STAFF");
  const p = props.payload;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
          backgroundColor: t.bgElevated
        },
        input: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 10,
          padding: 10,
          marginBottom: 8,
          color: t.text
        },
        btn: {
          padding: 12,
          borderRadius: 12,
          backgroundColor: t.accentPurple,
          alignItems: "center",
          marginBottom: 16
        },
        row: { flexDirection: "row", gap: 8, marginTop: 8 },
        small: { flex: 1, padding: 8, borderRadius: 8, backgroundColor: t.accentPurple, alignItems: "center" },
        reject: { backgroundColor: t.danger }
      }),
    [t]
  );

  return (
    <>
      {p.canInvite ? (
        <View style={styles.card}>
          <Text style={{ fontWeight: "900", fontSize: 16, color: t.text, marginBottom: 8 }}>Invite staff</Text>
          <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={t.textMuted} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={t.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Role (STAFF/KITCHEN/CASHIER)" placeholderTextColor={t.textMuted} value={role} onChangeText={setRole} autoCapitalize="characters" />
          <Pressable
            style={styles.btn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void inviteStaffMember(props.authToken, props.restaurantId, {
                fullName: name.trim(),
                email: email.trim(),
                intendedRole: role.trim().toUpperCase()
              }).then(() => {
                setName("");
                setEmail("");
                props.onReload();
              });
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Send invite</Text>
          </Pressable>
        </View>
      ) : null}
      <Text style={{ fontWeight: "800", color: t.textMuted, marginBottom: 6 }}>Pending approval</Text>
      {p.pendingApprovals.length === 0 ? (
        <Text style={{ color: t.textMuted, marginBottom: 12 }}>None</Text>
      ) : (
        p.pendingApprovals.map((row) => (
          <View key={row.membershipId} style={styles.card}>
            <Text style={{ fontWeight: "800", color: t.text }}>{row.fullName ?? row.email}</Text>
            <Text style={{ color: t.textSecondary }}>{row.role}</Text>
            {p.canApprove ? (
              <View style={styles.row}>
                <Pressable
                  style={styles.small}
                  onPress={() =>
                    void approveStaffMembership(props.authToken, props.restaurantId, row.membershipId).then(
                      () => props.onReload()
                    )
                  }
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Approve</Text>
                </Pressable>
                <Pressable
                  style={[styles.small, styles.reject]}
                  onPress={() =>
                    void rejectStaffMembership(props.authToken, props.restaurantId, row.membershipId).then(
                      () => props.onReload()
                    )
                  }
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
      <Text style={{ fontWeight: "800", color: t.textMuted, marginVertical: 6 }}>Active team</Text>
      {p.members
        .filter((m) => m.status === "ACTIVE")
        .map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={{ fontWeight: "700", color: t.text }}>{m.email ?? m.id}</Text>
            <Text style={{ color: t.textSecondary }}>{m.role}</Text>
          </View>
        ))}
    </>
  );
}
