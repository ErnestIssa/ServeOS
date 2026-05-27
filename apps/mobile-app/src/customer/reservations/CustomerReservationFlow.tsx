import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Animated } from "react-native";
import { fetchCustomerRestaurantDirectory } from "../../api";
import { GroupEventBookingScreen } from "./GroupEventBookingScreen";
import { ReservationAvailabilityScreen } from "./ReservationAvailabilityScreen";
import { ReservationBuilderScreen } from "./ReservationBuilderScreen";
import { ReservationConfirmationScreen } from "./ReservationConfirmationScreen";
import { ReservationGuestCheckoutScreen } from "./ReservationGuestCheckoutScreen";
import { ReservationLandingScreen } from "./ReservationLandingScreen";
import { ReservationManagementScreen } from "./ReservationManagementScreen";
import { createDefaultReservationDraft } from "./reservationDefaults";
import {
  mergeValidatedDraft,
  reservationStartErrorMessage,
  validateReservationStart
} from "./reservationApi";
import {
  type ReservationDraft,
  type ReservationFlowContext,
  type ReservationScreenId
} from "./reservationTypes";

type Props = ReservationFlowContext & {
  hasVenue: boolean;
  authToken: string | null;
  openingHours?: string | null;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onChooseVenue: () => void;
  onOpenChat: () => void;
  onExitToHome: () => void;
};

function makeConfirmationCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `SRV-${n}`;
}

export function CustomerReservationFlow(props: Props) {
  const [screen, setScreen] = React.useState<ReservationScreenId>("landing");
  const [resolvedHours, setResolvedHours] = React.useState<string | null | undefined>(
    props.openingHours
  );
  const [draft, setDraft] = React.useState<ReservationDraft>(() =>
    createDefaultReservationDraft(props.openingHours ?? null)
  );
  const [confirmationCode, setConfirmationCode] = React.useState("SRV-000000");
  const [startBookingLoading, setStartBookingLoading] = React.useState(false);
  const hoursBootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    if (props.openingHours !== undefined) {
      setResolvedHours(props.openingHours);
    }
  }, [props.openingHours]);

  React.useEffect(() => {
    if (props.openingHours !== undefined) return;
    if (!props.authToken?.trim() || !props.restaurantId.trim()) {
      setResolvedHours(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchCustomerRestaurantDirectory(props.authToken!);
      if (cancelled || !res.ok) return;
      const row = res.restaurants.find((r) => r.id === props.restaurantId);
      setResolvedHours(row?.openingHours ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.authToken, props.restaurantId, props.openingHours]);

  React.useEffect(() => {
    hoursBootstrappedRef.current = false;
    setResolvedHours(props.openingHours);
    setDraft(createDefaultReservationDraft(props.openingHours ?? null));
  }, [props.restaurantId, props.openingHours]);

  React.useEffect(() => {
    if (props.openingHours !== undefined) return;
    if (resolvedHours === undefined) return;
    if (hoursBootstrappedRef.current) return;
    hoursBootstrappedRef.current = true;
    setDraft(createDefaultReservationDraft(resolvedHours ?? null));
  }, [resolvedHours, props.openingHours]);

  const patchDraft = React.useCallback((patch: Partial<ReservationDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const go = React.useCallback((next: ReservationScreenId) => {
    void Haptics.selectionAsync();
    setScreen(next);
  }, []);

  const handleStartBooking = React.useCallback(async () => {
    if (!props.hasVenue) {
      props.onChooseVenue();
      return;
    }
    const token = props.authToken?.trim();
    if (!token) {
      Alert.alert("Sign in required", "Sign in as a customer to reserve a table.");
      return;
    }
    setStartBookingLoading(true);
    try {
      const res = await validateReservationStart(token, props.restaurantId, draft);
      if (res.ok && res.nextScreen === "builder") {
        setDraft((d) => mergeValidatedDraft(d, res.draft));
        go("builder");
        return;
      }
      Alert.alert("Can't continue yet", reservationStartErrorMessage(res.ok ? undefined : res.fields));
    } catch {
      Alert.alert("Connection issue", "We couldn't reach the server. Check your connection and try again.");
    } finally {
      setStartBookingLoading(false);
    }
  }, [draft, go, props.authToken, props.hasVenue, props.onChooseVenue, props.restaurantId]);

  const flowCtx: ReservationFlowContext = {
    restaurantId: props.restaurantId,
    restaurantName: props.restaurantName,
    userDisplayName: props.userDisplayName
  };

  const shared = {
    scrollY: props.scrollY,
    onScroll: props.onScroll,
    scrollTopPad: props.scrollTopPad,
    scrollBottom: props.scrollBottom
  };

  switch (screen) {
    case "landing":
      return (
        <ReservationLandingScreen
          {...flowCtx}
          {...shared}
          hasVenue={props.hasVenue}
          draft={draft}
          onDraftChange={patchDraft}
          onStartBooking={() => void handleStartBooking()}
          startBookingLoading={startBookingLoading}
          onManageBookings={() => go("management")}
          onGroupEvent={() => go("group_event")}
          onChooseVenue={props.onChooseVenue}
        />
      );
    case "builder":
      return (
        <ReservationBuilderScreen
          {...shared}
          draft={draft}
          onChange={patchDraft}
          onBack={() => go("landing")}
          onContinue={() => go("availability")}
        />
      );
    case "availability":
      return (
        <ReservationAvailabilityScreen
          {...shared}
          draft={draft}
          onChange={patchDraft}
          onBack={() => go("builder")}
          onContinue={() => go("checkout")}
          onWaitlist={() => {
            patchDraft({ slotLabel: "Waitlist" });
            go("checkout");
          }}
        />
      );
    case "checkout":
      return (
        <ReservationGuestCheckoutScreen
          {...flowCtx}
          {...shared}
          onBack={() => go("availability")}
          onConfirm={() => {
            setConfirmationCode(makeConfirmationCode());
            go("confirmation");
          }}
        />
      );
    case "confirmation":
      return (
        <ReservationConfirmationScreen
          {...flowCtx}
          {...shared}
          draft={draft}
          confirmationCode={confirmationCode}
          onManage={() => go("management")}
          onOpenChat={props.onOpenChat}
          onDone={() => {
            setScreen("landing");
            props.onExitToHome();
          }}
        />
      );
    case "management":
      return (
        <ReservationManagementScreen
          {...flowCtx}
          {...shared}
          confirmationCode={confirmationCode}
          onBack={() => go("landing")}
          onModify={() => go("builder")}
          onCancel={() => {
            Alert.alert("Cancel booking", "Cancellation will connect to the API later. For now this is a UI preview.", [
              { text: "OK" }
            ]);
          }}
          onCheckIn={() => {
            Alert.alert("Check-in", "Host desk check-in will be available in a later iteration.", [{ text: "OK" }]);
          }}
        />
      );
    case "group_event":
      return (
        <GroupEventBookingScreen
          {...flowCtx}
          {...shared}
          onBack={() => go("landing")}
          onSubmit={() => {
            Alert.alert(
              "Request sent",
              "Your events team will review this request. Standard table booking is available from the landing screen.",
              [{ text: "OK", onPress: () => go("landing") }]
            );
          }}
        />
      );
    default:
      return null;
  }
}
