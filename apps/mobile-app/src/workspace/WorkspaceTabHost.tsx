import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { MobileExperienceManifest } from "../mobile/mobileExperienceTypes";
import { fetchWorkspaceTab } from "../mobile/workspaceApi";
import type { WorkspaceContext } from "../mobile/workspaceApi";
import { useAppTheme } from "../theme/AppThemeContext";
import { OrdersQueueView } from "./views/OrdersQueueView";
import { StaffTasksView } from "./views/StaffTasksView";
import { StaffChatView } from "./views/StaffChatView";
import { StaffScheduleView } from "./views/StaffScheduleView";
import { StaffProfileView } from "./views/StaffProfileView";
import { AdminDashboardView } from "./views/AdminDashboardView";
import { AdminMenuView } from "./views/AdminMenuView";
import { AdminStaffView } from "./views/AdminStaffView";
import { AdminProfileView } from "./views/AdminProfileView";
import { OrderWorkspaceScreen, type OclWorkspaceTarget } from "./views/OrderWorkspaceScreen";

type Props = {
  tabKey: string;
  authToken: string;
  mobileExperience: MobileExperienceManifest;
  workspaceContext: WorkspaceContext | null;
  workspaceRestaurantId: string | null;
  onSelectVenue: (restaurantId: string) => void;
  scrollTopPad: number;
  scrollBottom: number;
  onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onScrollEndDrag?: () => void;
  onMomentumScrollEnd?: () => void;
  onNavigateTab?: (tabKey: string) => void;
  onSignOut?: () => void;
};

export function WorkspaceTabHost(props: Props) {
  const { colors: t } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<string>("");
  const [payload, setPayload] = React.useState<unknown>(null);
  const [filter, setFilter] = React.useState("all");
  const [queueMode, setQueueMode] = React.useState<string | undefined>(undefined);
  const [oclTarget, setOclTarget] = React.useState<OclWorkspaceTarget>(null);

  const rid = props.workspaceRestaurantId?.trim() || "";

  const openOrderWorkspace = React.useCallback((orderId: string) => {
    setOclTarget({ entityType: "order", entityId: orderId });
  }, []);

  const openReservationWorkspace = React.useCallback((reservationId: string) => {
    setOclTarget({ entityType: "reservation", entityId: reservationId });
  }, []);

  const reload = React.useCallback(
    async (opts?: { filter?: string; queueMode?: string }) => {
      if (!props.authToken) return;
      const f = opts?.filter ?? filter;
      const q = opts?.queueMode ?? queueMode;
      if (opts?.filter) setFilter(opts.filter);
      if (opts?.queueMode !== undefined) setQueueMode(opts.queueMode);
      const res = await fetchWorkspaceTab(props.authToken, props.tabKey, {
        restaurantId: rid || undefined,
        filter: f,
        queueMode: q
      });
      if (!res.ok) {
        setError(res.error ?? "Could not load");
        setPayload(null);
        return;
      }
      setError(null);
      setView(res.view);
      setPayload(res.payload);
      if ((res.payload as { activeFilter?: string })?.activeFilter) {
        setFilter((res.payload as { activeFilter: string }).activeFilter);
      }
      if ((res.payload as { activeMode?: string })?.activeMode) {
        setQueueMode((res.payload as { activeMode: string }).activeMode);
      }
    },
    [props.authToken, props.tabKey, rid, filter, queueMode]
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.tabKey, rid, props.authToken]);

  React.useEffect(() => {
    if (view !== "staff_orders" && view !== "admin_orders") return;
    const poll = setInterval(() => void reload(), 20_000);
    return () => clearInterval(poll);
  }, [view, reload]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const body = () => {
    if (loading) {
      return (
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <ActivityIndicator color={t.accentPurple} />
        </View>
      );
    }
    if (error) {
      return (
        <Text style={{ textAlign: "center", color: t.danger, fontWeight: "700", marginTop: 24 }}>{error}</Text>
      );
    }
    const p = payload as Record<string, unknown>;
    switch (view) {
      case "staff_orders":
      case "admin_orders":
        return (
          <OrdersQueueView
            authToken={props.authToken}
            payload={p as Parameters<typeof OrdersQueueView>[0]["payload"]}
            onReload={(o) => void reload(o)}
            onOpenOrder={openOrderWorkspace}
          />
        );
      case "staff_tasks":
        return (
          <StaffTasksView
            authToken={props.authToken}
            restaurantId={rid}
            tasks={(p.tasks as Parameters<typeof StaffTasksView>[0]["tasks"]) ?? []}
            onReload={() => void reload()}
            onOpenOrder={openOrderWorkspace}
          />
        );
      case "staff_chat":
        return (
          <StaffChatView
            authToken={props.authToken}
            restaurantId={rid}
            threads={(p.threads as Parameters<typeof StaffChatView>[0]["threads"]) ?? []}
            onReload={() => void reload()}
            onOpenOrder={openOrderWorkspace}
            onOpenReservation={openReservationWorkspace}
          />
        );
      case "staff_schedule":
        return (
          <StaffScheduleView
            authToken={props.authToken}
            restaurantId={rid}
            payload={p as Parameters<typeof StaffScheduleView>[0]["payload"]}
            onReload={() => void reload()}
          />
        );
      case "staff_profile":
        return (
          <StaffProfileView
            user={p.user as Parameters<typeof StaffProfileView>[0]["user"]}
            venue={p.venue as Parameters<typeof StaffProfileView>[0]["venue"]}
            sections={(p.sections as Parameters<typeof StaffProfileView>[0]["sections"]) ?? []}
            onSignOut={props.onSignOut ?? (() => undefined)}
          />
        );
      case "admin_dashboard":
        return (
          <AdminDashboardView
            payload={p as Parameters<typeof AdminDashboardView>[0]["payload"]}
            onNavigateTab={(k) => props.onNavigateTab?.(k)}
          />
        );
      case "admin_menu":
        return (
          <AdminMenuView
            authToken={props.authToken}
            restaurantId={rid}
            categories={(p.categories as Parameters<typeof AdminMenuView>[0]["categories"]) ?? []}
            canEdit={!!p.canEdit}
            onReload={() => void reload()}
          />
        );
      case "admin_staff":
        return (
          <AdminStaffView
            authToken={props.authToken}
            restaurantId={rid}
            payload={p as Parameters<typeof AdminStaffView>[0]["payload"]}
            onReload={() => void reload()}
          />
        );
      case "admin_profile":
        return <AdminProfileView payload={p as Parameters<typeof AdminProfileView>[0]["payload"]} />;
      default:
        return (
          <Text style={{ color: t.textMuted, textAlign: "center", marginTop: 24 }}>
            This workspace view is not available yet.
          </Text>
        );
    }
  };

  return (
    <>
    <OrderWorkspaceScreen
      visible={!!oclTarget}
      target={oclTarget}
      authToken={props.authToken}
      onClose={() => setOclTarget(null)}
      onChanged={() => {
        if (view === "staff_orders" || view === "admin_orders") void reload();
      }}
    />
    <ScrollView
      style={styles.scroll}
      onScroll={props.onScroll}
      onScrollEndDrag={props.onScrollEndDrag}
      onMomentumScrollEnd={props.onMomentumScrollEnd}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: props.scrollTopPad, paddingBottom: props.scrollBottom, paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      showsVerticalScrollIndicator={false}
    >
      {body()}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }
});
