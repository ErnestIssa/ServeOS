import AsyncStorage from "@react-native-async-storage/async-storage";
import { authScope } from "../../data/cache/cacheKeys";
import {
  EMPTY_RESERVATION_DRAFT,
  type ReservationDraft,
  type ReservationScreenId
} from "./reservationTypes";

export type ReservationScrollByScreen = Partial<Record<ReservationScreenId, number>>;

export type PersistedReservationFlow = {
  draft: ReservationDraft;
  screen: ReservationScreenId;
  scrollByScreen?: ReservationScrollByScreen;
  updatedAt: number;
};

const memory = new Map<string, PersistedReservationFlow>();

function storageKey(scope: string, restaurantId: string): string {
  const rid = restaurantId.trim() || "_none";
  return `${scope}:reservation:flow:${rid}`;
}

function normalizeDraft(raw: unknown): ReservationDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const guests = typeof o.guests === "number" && o.guests >= 1 ? o.guests : null;
  const dateLabel = typeof o.dateLabel === "string" ? o.dateLabel.trim() : "";
  const timeLabel = typeof o.timeLabel === "string" ? o.timeLabel.trim() : "";
  if (!guests || !dateLabel || !timeLabel) return null;

  const quickPickIds = Array.isArray(o.quickPickIds)
    ? o.quickPickIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  return {
    ...EMPTY_RESERVATION_DRAFT,
    branchId: typeof o.branchId === "string" ? o.branchId : null,
    quickDateId: typeof o.quickDateId === "string" ? o.quickDateId : null,
    quickPickIds,
    guests,
    dateLabel,
    timeLabel,
    seatingPreference: typeof o.seatingPreference === "string" ? o.seatingPreference : null,
    occasion: typeof o.occasion === "string" ? o.occasion : null,
    accessibilityNotes: typeof o.accessibilityNotes === "string" ? o.accessibilityNotes : "",
    tableId: typeof o.tableId === "string" ? o.tableId : null,
    slotLabel: typeof o.slotLabel === "string" ? o.slotLabel : null,
    checkoutUseProfile: o.checkoutUseProfile !== false,
    checkoutDeposit: o.checkoutDeposit === true,
    checkoutSms: o.checkoutSms !== false,
    checkoutEmail: o.checkoutEmail === true
  };
}

const SCREEN_IDS = new Set<ReservationScreenId>([
  "landing",
  "builder",
  "availability",
  "checkout",
  "confirmation",
  "management",
  "group_event"
]);

function normalizeScreen(raw: unknown): ReservationScreenId {
  return typeof raw === "string" && SCREEN_IDS.has(raw as ReservationScreenId)
    ? (raw as ReservationScreenId)
    : "landing";
}

function normalizeScrollByScreen(raw: unknown): ReservationScrollByScreen | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: ReservationScrollByScreen = {};
  for (const id of SCREEN_IDS) {
    const y = (raw as Record<string, unknown>)[id];
    if (typeof y === "number" && Number.isFinite(y) && y >= 0) out[id] = y;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function readReservationFlowMemory(
  userId: string | null | undefined,
  restaurantId: string
): PersistedReservationFlow | null {
  return memory.get(storageKey(authScope(userId), restaurantId)) ?? null;
}

export function writeReservationFlowMemory(
  userId: string | null | undefined,
  restaurantId: string,
  state: PersistedReservationFlow
): void {
  memory.set(storageKey(authScope(userId), restaurantId), state);
}

export async function loadReservationFlow(
  userId: string | null | undefined,
  restaurantId: string
): Promise<PersistedReservationFlow | null> {
  const scope = authScope(userId);
  const mem = readReservationFlowMemory(userId, restaurantId);
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(storageKey(scope, restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      draft?: unknown;
      screen?: unknown;
      scrollByScreen?: ReservationScrollByScreen;
    };
    const draft = normalizeDraft(parsed.draft);
    if (!draft) return null;
    const state: PersistedReservationFlow = {
      draft,
      screen: normalizeScreen(parsed.screen),
      scrollByScreen: normalizeScrollByScreen(parsed.scrollByScreen),
      updatedAt: Date.now()
    };
    writeReservationFlowMemory(userId, restaurantId, state);
    return state;
  } catch {
    return null;
  }
}

export async function saveReservationFlow(
  userId: string | null | undefined,
  restaurantId: string,
  state: PersistedReservationFlow
): Promise<void> {
  writeReservationFlowMemory(userId, restaurantId, state);
  try {
    await AsyncStorage.setItem(
      storageKey(authScope(userId), restaurantId),
      JSON.stringify({
        draft: state.draft,
        screen: state.screen,
        scrollByScreen: state.scrollByScreen
      })
    );
  } catch {
    /* best-effort */
  }
}
