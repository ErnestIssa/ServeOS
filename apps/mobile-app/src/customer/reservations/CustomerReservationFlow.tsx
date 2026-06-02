import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Animated, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { fetchCustomerRestaurantDirectory } from "../../api";
import { GroupEventBookingScreen } from "./GroupEventBookingScreen";
import { ReservationAvailabilityScreen } from "./ReservationAvailabilityScreen";
import { ReservationBuilderScreen } from "./ReservationBuilderScreen";
import { ReservationConfirmationScreen } from "./ReservationConfirmationScreen";
import {
  ReservationFlowScreenLayer,
  RESERVATION_SLIDE_ENTER_MS,
  type ReservationSlideDirection
} from "./ReservationFlowScreenLayer";
import { ReservationImmersiveHero } from "./ReservationImmersiveHero";
import {
  isReservationBookFlowScreen,
  normalizeReservationScreen,
  reservationBookFlowIndex
} from "./reservationBookSteps";
import { immersiveRaisedScrollY, immersiveSheetTopOffset } from "./reservationImmersiveMetrics";
import { ReservationLandingScreen } from "./ReservationLandingScreen";
import { ReservationManagementScreen } from "./ReservationManagementScreen";
import { createDefaultReservationDraft } from "./reservationDefaults";
import {
  loadReservationFlow,
  readReservationFlowMemory,
  saveReservationFlow,
  writeReservationFlowMemory,
  type ReservationScrollByScreen
} from "./reservationDraftStorage";
import {
  cancelCustomerReservation,
  confirmCustomerReservation,
  mergeValidatedDraft,
  patchCustomerReservation,
  reservationStartErrorMessage,
  validateReservationStart,
  type CustomerReservationApi
} from "./reservationApi";
import {
  type ReservationDraft,
  type ReservationFlowContext,
  type ReservationScreenId
} from "./reservationTypes";

type Props = ReservationFlowContext & {
  hasVenue: boolean;
  authToken: string | null;
  userId?: string | null;
  openingHours?: string | null;
  scrollY: Animated.Value;
  onScroll: ReturnType<typeof Animated.event>;
  scrollTopPad: number;
  scrollBottom: number;
  onChooseVenue: () => void;
  onOpenChat: () => void;
  onExitToHome: () => void;
  /** Reset shared bookings scroll (hero + sheet) when changing steps. */
  onResetScroll: () => void;
  /** Restore shared bookings scroll after cold load / venue switch (defaults to `scrollY`). */
  onRestoreScroll?: (y: number) => void;
};

type ScrollRestore = {
  token: number;
  screen: ReservationScreenId;
  y: number;
};

function readAnimatedScrollY(scrollY: Animated.Value): number {
  const v = scrollY as Animated.Value & { __getValue?: () => number };
  return typeof v.__getValue === "function" ? Math.max(0, v.__getValue()) : 0;
}

type BookFlowSlidePair = {
  exiting: ReservationScreenId;
  entering: ReservationScreenId;
  direction: ReservationSlideDirection;
};

export function CustomerReservationFlow(props: Props) {
  const restaurantId = props.restaurantId.trim();
  const cached = readReservationFlowMemory(props.userId, restaurantId);

  const initialScreen = normalizeReservationScreen(cached?.screen ?? "landing");
  const [screen, setScreen] = React.useState<ReservationScreenId>(initialScreen);
  const [visitedScreens, setVisitedScreens] = React.useState<Set<ReservationScreenId>>(
    () => new Set<ReservationScreenId>(["landing", initialScreen])
  );
  const [resolvedHours, setResolvedHours] = React.useState<string | null | undefined>(
    props.openingHours
  );
  const [draft, setDraft] = React.useState<ReservationDraft>(
    () => cached?.draft ?? createDefaultReservationDraft(props.openingHours ?? null)
  );
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const screenRef = React.useRef(screen);
  screenRef.current = screen;
  const [confirmationCode, setConfirmationCode] = React.useState("SRV-000000");
  const [confirmedReservation, setConfirmedReservation] = React.useState<CustomerReservationApi | null>(null);
  const confirmedReservationId = confirmedReservation?.id ?? null;
  const [startBookingLoading, setStartBookingLoading] = React.useState(false);
  const [continueBookingLoading, setContinueBookingLoading] = React.useState(false);
  const [confirmBookingLoading, setConfirmBookingLoading] = React.useState(false);
  const [groupEventTypeId, setGroupEventTypeId] = React.useState("corporate");
  const [groupSizeId, setGroupSizeId] = React.useState<string | null>(null);
  const [groupPkgId, setGroupPkgId] = React.useState<string | null>(null);
  const [groupVipIds, setGroupVipIds] = React.useState<Set<string>>(() => new Set());
  const hoursBootstrappedRef = React.useRef(false);
  const screenScrollYRef = React.useRef<ReservationScrollByScreen>(
    cached?.scrollByScreen ? { ...cached.scrollByScreen } : {}
  );
  const [stepEnterToken, setStepEnterToken] = React.useState(0);
  const [stepEnterScrollY, setStepEnterScrollY] = React.useState<number | undefined>();
  const [bookFlowSlide, setBookFlowSlide] = React.useState<BookFlowSlidePair | null>(null);
  const { height: screenH } = useWindowDimensions();
  const [scrollRestore, setScrollRestore] = React.useState<ScrollRestore | null>(() => {
    const y = cached?.scrollByScreen?.[cached.screen ?? "landing"];
    if (y == null) return null;
    return { token: Date.now(), screen: cached!.screen, y };
  });

  const onBookingsScroll = React.useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: props.scrollY } } }], {
        useNativeDriver: false,
        listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
          screenScrollYRef.current[screenRef.current] = Math.max(0, e.nativeEvent.contentOffset.y);
        }
      }),
    [props.scrollY]
  );

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

  const persistFlow = React.useCallback(
    (nextDraft: ReservationDraft, nextScreen: ReservationScreenId) => {
      if (!restaurantId) return;
      const state = {
        draft: nextDraft,
        screen: nextScreen,
        scrollByScreen: { ...screenScrollYRef.current },
        updatedAt: Date.now()
      };
      writeReservationFlowMemory(props.userId, restaurantId, state);
      void saveReservationFlow(props.userId, restaurantId, state);
    },
    [props.userId, restaurantId]
  );

  const captureScrollNow = React.useCallback(() => {
    screenScrollYRef.current[screenRef.current] = readAnimatedScrollY(props.scrollY);
  }, [props.scrollY]);

  const restoreSharedScroll = React.useCallback(
    (y: number) => {
      const safe = Math.max(0, y);
      if (typeof props.onRestoreScroll === "function") {
        props.onRestoreScroll(safe);
      } else {
        props.scrollY.setValue(safe);
      }
    },
    [props.onRestoreScroll, props.scrollY]
  );

  const markVisited = React.useCallback((id: ReservationScreenId) => {
    setVisitedScreens((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  /** Swap visible layer only — mounted screens keep their scroll offset. */
  const activateScreen = React.useCallback(
    (target: ReservationScreenId) => {
      markVisited(target);
      screenRef.current = target;
      const y = screenScrollYRef.current[target] ?? 0;
      props.scrollY.setValue(y);
      setScreen(target);
    },
    [markVisited, props.scrollY]
  );

  React.useEffect(() => {
    if (!scrollRestore) return;
    const id = requestAnimationFrame(() => setScrollRestore(null));
    return () => cancelAnimationFrame(id);
  }, [scrollRestore]);

  const coldScrollPropsFor = React.useCallback(
    (id: ReservationScreenId) => ({
      restoreScrollY: scrollRestore?.screen === id ? scrollRestore.y : undefined,
      scrollRestoreToken: scrollRestore?.screen === id ? scrollRestore.token : undefined
    }),
    [scrollRestore]
  );

  React.useEffect(() => {
    hoursBootstrappedRef.current = false;
    setResolvedHours(props.openingHours);

    const mem = readReservationFlowMemory(props.userId, restaurantId);
    if (mem) {
      setDraft(mem.draft);
      setScreen(mem.screen);
      if (mem.scrollByScreen) screenScrollYRef.current = { ...mem.scrollByScreen };
      const y = mem.scrollByScreen?.[mem.screen] ?? 0;
      restoreSharedScroll(y);
      setScrollRestore({ token: Date.now(), screen: mem.screen, y });
      return;
    }

    let cancelled = false;
    void (async () => {
      const loaded = await loadReservationFlow(props.userId, restaurantId);
      if (cancelled) return;
      if (loaded) {
        setDraft(loaded.draft);
        setScreen(loaded.screen);
        if (loaded.scrollByScreen) screenScrollYRef.current = { ...loaded.scrollByScreen };
        const y = loaded.scrollByScreen?.[loaded.screen] ?? 0;
        restoreSharedScroll(y);
        setScrollRestore({ token: Date.now(), screen: loaded.screen, y });
        return;
      }
      setDraft(createDefaultReservationDraft(props.openingHours ?? null));
      setScreen("landing");
    })();

    return () => {
      cancelled = true;
    };
  }, [props.userId, restaurantId, restoreSharedScroll]);

  React.useEffect(() => {
    if (props.openingHours !== undefined) return;
    if (resolvedHours === undefined) return;
    if (hoursBootstrappedRef.current) return;
    hoursBootstrappedRef.current = true;
    if (readReservationFlowMemory(props.userId, restaurantId)) return;
    setDraft((d) => ({
      ...d,
      timeLabel: createDefaultReservationDraft(resolvedHours ?? null).timeLabel
    }));
  }, [resolvedHours, props.openingHours, props.userId, restaurantId]);

  React.useEffect(() => {
    return () => {
      if (!restaurantId) return;
      persistFlow(draftRef.current, screenRef.current);
    };
  }, [persistFlow, restaurantId]);

  const patchDraft = React.useCallback(
    (patch: Partial<ReservationDraft>) => {
      setDraft((d) => {
        const next = { ...d, ...patch };
        persistFlow(next, screenRef.current);
        return next;
      });
    },
    [persistFlow]
  );

  const applyRaisedScrollFor = React.useCallback(
    (target: ReservationScreenId) => {
      const y = immersiveRaisedScrollY(screenH, props.scrollTopPad);
      screenScrollYRef.current[target] = y;
      props.scrollY.setValue(y);
      setStepEnterScrollY(y);
      setStepEnterToken((n) => n + 1);
      return y;
    },
    [screenH, props.scrollTopPad, props.scrollY]
  );

  const slidePropsFor = React.useCallback(
    (id: ReservationScreenId) => ({
      slidePhase:
        bookFlowSlide?.exiting === id ? ("exit" as const) : bookFlowSlide?.entering === id ? ("enter" as const) : null,
      slideDirection: bookFlowSlide?.direction ?? null
    }),
    [bookFlowSlide]
  );

  const bookStepPresentationProps = React.useCallback(
    (id: ReservationScreenId) => ({
      presentationActive: screen === id,
      enterScrollToken: stepEnterToken > 0 ? stepEnterToken : undefined,
      enterScrollTargetY: stepEnterScrollY
    }),
    [screen, stepEnterScrollY, stepEnterToken]
  );

  /** Linear book flow — vertical slide + raised card (steps 2+). */
  const navigateBookFlow = React.useCallback(
    (to: ReservationScreenId) => {
      const from = screenRef.current;
      if (from === to) return;

      const fromIdx = reservationBookFlowIndex(from);
      const toIdx = reservationBookFlowIndex(to);

      if (fromIdx >= 0 && toIdx >= 0) {
        void Haptics.selectionAsync();
        captureScrollNow();
        const forward = toIdx > fromIdx;
        markVisited(to);

        if (to === "landing") {
          const y = screenScrollYRef.current.landing ?? 0;
          props.scrollY.setValue(y);
        } else {
          const saved = screenScrollYRef.current[to];
          if (forward || saved == null) {
            applyRaisedScrollFor(to);
          } else {
            // Back: snap shared offset only — previous step stays mounted at its saved scroll.
            props.scrollY.setValue(saved);
          }
        }

        screenRef.current = to;
        setScreen(to);
        persistFlow(draftRef.current, to);

        if (Platform.OS === "web") {
          setBookFlowSlide(null);
          return;
        }

        setBookFlowSlide({
          exiting: from,
          entering: to,
          direction: forward ? "forward" : "back"
        });
        setTimeout(() => setBookFlowSlide(null), RESERVATION_SLIDE_ENTER_MS + 48);
        return;
      }

      void Haptics.selectionAsync();
      captureScrollNow();
      activateScreen(to);
      persistFlow(draftRef.current, to);
    },
    [applyRaisedScrollFor, activateScreen, captureScrollNow, markVisited, persistFlow, props.scrollY]
  );

  const goBack = React.useCallback(
    (target: ReservationScreenId) => {
      if (isReservationBookFlowScreen(screenRef.current) && isReservationBookFlowScreen(target)) {
        navigateBookFlow(target);
        return;
      }
      void Haptics.selectionAsync();
      captureScrollNow();
      activateScreen(target);
      persistFlow(draftRef.current, target);
    },
    [activateScreen, captureScrollNow, navigateBookFlow, persistFlow]
  );

  const goForward = React.useCallback(
    (target: ReservationScreenId, opts?: { resetScroll?: boolean }) => {
      if (isReservationBookFlowScreen(screenRef.current) && isReservationBookFlowScreen(target)) {
        if (opts?.resetScroll) {
          screenScrollYRef.current[target] = 0;
        }
        navigateBookFlow(target);
        return;
      }
      void Haptics.selectionAsync();
      captureScrollNow();
      if (opts?.resetScroll) {
        screenScrollYRef.current[target] = 0;
      }
      activateScreen(target);
      persistFlow(draftRef.current, target);
    },
    [activateScreen, captureScrollNow, navigateBookFlow, persistFlow]
  );

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
        const next = mergeValidatedDraft(draftRef.current, res.draft);
        draftRef.current = next;
        setDraft(next);
        navigateBookFlow("builder");
        return;
      }
      Alert.alert("Can't continue yet", reservationStartErrorMessage(res.ok ? undefined : res.fields));
    } catch {
      Alert.alert("Connection issue", "We couldn't reach the server. Check your connection and try again.");
    } finally {
      setStartBookingLoading(false);
    }
  }, [
    draft,
    navigateBookFlow,
    props.authToken,
    props.hasVenue,
    props.onChooseVenue,
    props.restaurantId
  ]);

  const flowCtx: ReservationFlowContext = {
    restaurantId: props.restaurantId,
    restaurantName: props.restaurantName,
    userDisplayName: props.userDisplayName
  };

  const shared = {
    scrollY: props.scrollY,
    onScroll: onBookingsScroll,
    scrollTopPad: props.scrollTopPad,
    scrollBottom: props.scrollBottom
  };

  const immersive = {
    ...shared,
    restaurantName: props.restaurantName,
    hasVenue: props.hasVenue,
    embedHero: false as const
  };

  const flowHeroSheetTop = immersiveSheetTopOffset(screenH);

  const toggleGroupVip = React.useCallback((id: string) => {
    setGroupVipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleContinueFromBuilder = React.useCallback(async () => {
    setContinueBookingLoading(true);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      navigateBookFlow("availability");
    } finally {
      setContinueBookingLoading(false);
    }
  }, [navigateBookFlow]);

  const handleConfirmFromAvailability = React.useCallback(async () => {
    const token = props.authToken?.trim();
    if (!token) {
      Alert.alert("Sign in required", "Sign in as a customer to confirm your booking.");
      return;
    }
    setConfirmBookingLoading(true);
    try {
      const existingId = confirmedReservationId;
      const res = existingId
        ? await patchCustomerReservation(token, existingId, draftRef.current)
        : await confirmCustomerReservation(token, props.restaurantId, draftRef.current);
      if (!res.ok) {
        Alert.alert(
          "Can't confirm yet",
          reservationStartErrorMessage("fields" in res ? res.fields : undefined)
        );
        return;
      }
      setConfirmationCode(res.reservation.confirmationCode);
      setConfirmedReservation(res.reservation);
      navigateBookFlow("confirmation");
    } catch {
      Alert.alert("Connection issue", "We couldn't reach the server. Check your connection and try again.");
    } finally {
      setConfirmBookingLoading(false);
    }
  }, [confirmedReservationId, navigateBookFlow, props.authToken, props.restaurantId]);

  return (
    <View style={styles.flowRoot}>
      <View style={styles.flowHero} pointerEvents="none">
        <ReservationImmersiveHero
          venueName={props.restaurantName}
          hasVenue={props.hasVenue}
          topInset={props.scrollTopPad}
          sheetTopOffset={flowHeroSheetTop}
          scrollY={props.scrollY}
          scrollLinked={false}
        />
      </View>

      {visitedScreens.has("landing") ? (
        <ReservationFlowScreenLayer active={screen === "landing"} {...slidePropsFor("landing")}>
          <ReservationLandingScreen
            {...flowCtx}
            {...shared}
            hasVenue={props.hasVenue}
            authToken={props.authToken}
            draft={draft}
            onDraftChange={patchDraft}
            onStartBooking={() => void handleStartBooking()}
            startBookingLoading={startBookingLoading}
            onManageBookings={() => goForward("management")}
            onGroupEvent={() => goForward("group_event")}
            onChooseVenue={props.onChooseVenue}
            {...coldScrollPropsFor("landing")}
          />
        </ReservationFlowScreenLayer>
      ) : null}

      {visitedScreens.has("builder") ? (
        <ReservationFlowScreenLayer active={screen === "builder"} {...slidePropsFor("builder")}>
          <ReservationBuilderScreen
            {...immersive}
            {...coldScrollPropsFor("builder")}
            {...bookStepPresentationProps("builder")}
            hasVenue={props.hasVenue}
            draft={draft}
            onChange={patchDraft}
            continueLoading={continueBookingLoading}
            onBack={() => goBack("landing")}
            onContinue={() => void handleContinueFromBuilder()}
          />
        </ReservationFlowScreenLayer>
      ) : null}

      {visitedScreens.has("availability") ? (
        <ReservationFlowScreenLayer active={screen === "availability"} {...slidePropsFor("availability")}>
          <ReservationAvailabilityScreen
            {...immersive}
            {...coldScrollPropsFor("availability")}
            {...bookStepPresentationProps("availability")}
            hasVenue={props.hasVenue}
            draft={draft}
            onChange={patchDraft}
            confirmLoading={confirmBookingLoading}
            onBack={() => goBack("builder")}
            onConfirm={() => void handleConfirmFromAvailability()}
          />
        </ReservationFlowScreenLayer>
      ) : null}

      {visitedScreens.has("confirmation") ? (
        <ReservationFlowScreenLayer active={screen === "confirmation"} {...slidePropsFor("confirmation")}>
          <ReservationConfirmationScreen
            {...flowCtx}
            {...immersive}
            {...coldScrollPropsFor("confirmation")}
            {...bookStepPresentationProps("confirmation")}
            hasVenue={props.hasVenue}
            draft={draft}
            confirmationCode={confirmationCode}
            reservation={confirmedReservation}
            authToken={props.authToken}
            onNeedHelp={props.onOpenChat}
            onClose={() => goBack("landing")}
            onReservationUpdated={(next) => {
              setConfirmedReservation(next);
              setConfirmationCode(next.confirmationCode);
              setDraft(next.draft);
              draftRef.current = next.draft;
              persistFlow(next.draft, "confirmation");
            }}
            onReservationCancelled={() => {
              setConfirmedReservation(null);
              setConfirmationCode("SRV-000000");
              setScreen("landing");
              props.onExitToHome();
            }}
          />
        </ReservationFlowScreenLayer>
      ) : null}

      {visitedScreens.has("management") ? (
        <ReservationFlowScreenLayer active={screen === "management"}>
          <ReservationManagementScreen
            {...flowCtx}
            {...immersive}
            {...coldScrollPropsFor("management")}
            confirmationCode={confirmationCode}
            onBack={() => goBack("landing")}
            onModify={() => goForward("builder")}
            onCancel={() => {
              const token = props.authToken?.trim();
              const id = confirmedReservationId;
              if (!token || !id) {
                Alert.alert("No active booking", "Confirm a booking first.");
                return;
              }
              Alert.alert("Cancel booking?", "This cannot be undone.", [
                { text: "Keep booking", style: "cancel" },
                {
                  text: "Cancel booking",
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      try {
                        const res = await cancelCustomerReservation(token, id);
                        if (!res.ok) {
                          Alert.alert("Couldn't cancel", "Please try again.");
                          return;
                        }
                        setConfirmedReservationId(null);
                        goBack("landing");
                      } catch {
                        Alert.alert("Connection issue", "We couldn't reach the server.");
                      }
                    })();
                  }
                }
              ]);
            }}
            onCheckIn={() => {
              Alert.alert("Check-in", "Host desk check-in will be available in a later iteration.", [{ text: "OK" }]);
            }}
          />
        </ReservationFlowScreenLayer>
      ) : null}

      {visitedScreens.has("group_event") ? (
        <ReservationFlowScreenLayer active={screen === "group_event"}>
          <GroupEventBookingScreen
            {...immersive}
            {...coldScrollPropsFor("group_event")}
            eventTypeId={groupEventTypeId}
            sizeId={groupSizeId}
            pkgId={groupPkgId}
            vipIds={groupVipIds}
            onEventTypeId={setGroupEventTypeId}
            onSizeId={setGroupSizeId}
            onPkgId={setGroupPkgId}
            onToggleVip={toggleGroupVip}
            onBack={() => goBack("landing")}
            onSubmit={() => {
              Alert.alert(
                "Request sent",
                "Your events team will review this request. Standard table booking is available from the landing screen.",
                [{ text: "OK", onPress: () => goBack("landing") }]
              );
            }}
          />
        </ReservationFlowScreenLayer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flowRoot: { flex: 1 },
  flowHero: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 0
  }
});
