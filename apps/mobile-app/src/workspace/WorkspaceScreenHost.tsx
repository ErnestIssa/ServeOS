import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { formatDisplayMoney } from "../formatMoney";
import { useAppTheme } from "../theme/AppThemeContext";
import { fetchWorkspaceScreen, patchOrderStatus, type WorkspaceScreenResponse } from "../mobile/workspaceApi";
import { ProfilePlaceholderScreen } from "../customer/profile/ProfilePlaceholderScreen";
import { ProfileScreenContainer, SectionLabel } from "../customer/profile/ProfileUi";

type Props = {
  screenKey: string;
  authToken: string;
  restaurantId?: string | null;
  topInset: number;
  bottomInset: number;
  title: string;
  subtitle?: string;
};

type OrderRow = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  note?: string | null;
  lineCount: number;
};

const NEXT_STATUS: Record<string, string> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED"
};

export function WorkspaceScreenHost(props: Props) {
  const { colors: t } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<WorkspaceScreenResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWorkspaceScreen(
        props.authToken,
        props.screenKey,
        props.restaurantId ?? undefined
      );
      if (!res.ok) {
        setError(res.error ?? "Could not load");
        setData(null);
      } else {
        setData(res);
      }
    } catch {
      setError("Could not reach server");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.authToken, props.screenKey, props.restaurantId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
        err: { color: t.danger, fontWeight: "700", textAlign: "center" },
        card: {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: t.radius.card,
          padding: t.space.md,
          marginBottom: t.space.sm,
          backgroundColor: t.bgElevated
        },
        cardTitle: { fontSize: 16, fontWeight: "800", color: t.text },
        cardSub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: t.textSecondary },
        metric: { fontSize: 28, fontWeight: "900", color: t.accentPurple },
        metricLabel: { fontSize: 12, fontWeight: "700", color: t.textMuted, marginTop: 4 },
        btn: {
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: t.accentPurple
        },
        btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
        body: { fontSize: 15, fontWeight: "600", color: t.textSecondary, lineHeight: 22 }
      }),
    [t]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.accentPurple} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <ProfilePlaceholderScreen
        title={props.title}
        subtitle={error ?? "Unavailable"}
        topInset={props.topInset}
        bottomInset={props.bottomInset}
      />
    );
  }

  if (data.status === "coming_soon" || !data.payload) {
    return (
      <ProfilePlaceholderScreen
        title={data.title}
        subtitle={data.subtitle}
        topInset={props.topInset}
        bottomInset={props.bottomInset}
      />
    );
  }

  const payload = data.payload as Record<string, unknown>;

  if (props.screenKey === "admin.dashboard") {
    const p = payload as {
      activeOrderCount: number;
      completedToday: number;
      upcomingReservations: number;
      revenueActiveCents: number;
    };
    return (
      <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
        <SectionLabel variant="me">Today</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={[styles.card, { flex: 1, minWidth: 140 }]}>
            <Text style={styles.metric}>{p.activeOrderCount}</Text>
            <Text style={styles.metricLabel}>Active orders</Text>
          </View>
          <View style={[styles.card, { flex: 1, minWidth: 140 }]}>
            <Text style={styles.metric}>{p.completedToday}</Text>
            <Text style={styles.metricLabel}>Completed today</Text>
          </View>
          <View style={[styles.card, { flex: 1, minWidth: 140 }]}>
            <Text style={styles.metric}>{p.upcomingReservations}</Text>
            <Text style={styles.metricLabel}>Upcoming bookings</Text>
          </View>
        </View>
        <Text style={[styles.cardSub, { marginTop: 8 }]}>
          Active queue value: {formatDisplayMoney(p.revenueActiveCents)}
        </Text>
      </ProfileScreenContainer>
    );
  }

  if (
    props.screenKey === "admin.live_orders" ||
    props.screenKey === "staff.assigned_orders" ||
    props.screenKey === "staff.kitchen_queue" ||
    props.screenKey === "staff.checkout_queue"
  ) {
    const orders = (payload.orders as OrderRow[]) ?? [];
    return (
      <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
        {orders.length === 0 ? (
          <Text style={styles.body}>No orders in this queue.</Text>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {o.status} · {(o.totalCents / 100).toFixed(2)}
              </Text>
              <Text style={styles.cardSub}>
                {o.lineCount} item{o.lineCount === 1 ? "" : "s"}
                {o.note ? ` · ${o.note}` : ""}
              </Text>
              {NEXT_STATUS[o.status] ? (
                <Pressable
                  style={styles.btn}
                  onPress={() => {
                    void patchOrderStatus(props.authToken, o.id, NEXT_STATUS[o.status]!).then(() =>
                      reload()
                    );
                  }}
                >
                  <Text style={styles.btnText}>Mark {NEXT_STATUS[o.status]}</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ProfileScreenContainer>
    );
  }

  if (props.screenKey === "admin.restaurant_profile" || props.screenKey === "admin.restaurant_settings") {
    const r = payload.restaurant as {
      name: string;
      openingHours?: string | null;
      establishmentLocation?: string | null;
      venueSubtype?: string | null;
      offeringsDescription?: string | null;
    };
    return (
      <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{r.name}</Text>
          {r.venueSubtype ? <Text style={styles.cardSub}>{r.venueSubtype}</Text> : null}
          {r.establishmentLocation ? <Text style={styles.cardSub}>{r.establishmentLocation}</Text> : null}
          {r.openingHours ? <Text style={styles.cardSub}>Hours: {r.openingHours}</Text> : null}
          {r.offeringsDescription ? <Text style={styles.cardSub}>{r.offeringsDescription}</Text> : null}
        </View>
      </ProfileScreenContainer>
    );
  }

  if (props.screenKey === "admin.menu") {
    const categories = (payload.categories as Array<{ name: string; items: Array<{ name: string; priceCents: number }> }>) ?? [];
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: props.bottomInset + 24 }}>
        <ProfileScreenContainer topInset={props.topInset} bottomInset={0}>
          {categories.map((c) => (
            <View key={c.name} style={{ marginBottom: t.space.md }}>
              <SectionLabel variant="me">{c.name}</SectionLabel>
              {c.items.map((item) => (
                <View key={item.name} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSub}>{formatDisplayMoney(item.priceCents)}</Text>
                </View>
              ))}
            </View>
          ))}
        </ProfileScreenContainer>
      </ScrollView>
    );
  }

  if (props.screenKey === "admin.staff_management") {
    const p = payload as {
      pendingApprovals?: Array<{ membershipId: string; fullName: string | null; email: string | null; role: string }>;
      pendingInvitations?: Array<{ id: string; fullName: string; email: string; intendedRole: string }>;
      members?: Array<{ id: string; role: string; status: string; email: string | null }>;
      accessPolicy?: { maxManagers: number; allowManagersToInviteManagers: boolean };
    };
    return (
      <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
        <SectionLabel variant="me">Pending approvals</SectionLabel>
        {(p.pendingApprovals ?? []).length === 0 ? (
          <Text style={styles.body}>No accounts awaiting approval.</Text>
        ) : (
          (p.pendingApprovals ?? []).map((row) => (
            <View key={row.membershipId} style={styles.card}>
              <Text style={styles.cardTitle}>{row.fullName ?? row.email ?? "Team member"}</Text>
              <Text style={styles.cardSub}>
                {row.role} · Awaiting approval
              </Text>
            </View>
          ))
        )}
        <SectionLabel variant="me">Open invitations</SectionLabel>
        {(p.pendingInvitations ?? []).length === 0 ? (
          <Text style={styles.body}>No pending invites. Use the API or web admin to invite team members.</Text>
        ) : (
          (p.pendingInvitations ?? []).map((inv) => (
            <View key={inv.id} style={styles.card}>
              <Text style={styles.cardTitle}>{inv.fullName}</Text>
              <Text style={styles.cardSub}>
                {inv.intendedRole} · {inv.email}
              </Text>
            </View>
          ))
        )}
        <SectionLabel variant="me">Active team</SectionLabel>
        {(p.members ?? [])
          .filter((m) => m.status === "ACTIVE")
          .map((m) => (
            <View key={m.id} style={styles.card}>
              <Text style={styles.cardTitle}>{m.email ?? m.id}</Text>
              <Text style={styles.cardSub}>{m.role}</Text>
            </View>
          ))}
      </ProfileScreenContainer>
    );
  }

  if (props.screenKey === "shared.help" || props.screenKey === "shared.about") {
    return (
      <ProfilePlaceholderScreen
        title={data.title}
        subtitle={String(payload.body ?? data.subtitle)}
        topInset={props.topInset}
        bottomInset={props.bottomInset}
      />
    );
  }

  return (
    <ProfilePlaceholderScreen
      title={data.title}
      subtitle={data.subtitle}
      topInset={props.topInset}
      bottomInset={props.bottomInset}
    />
  );
}
