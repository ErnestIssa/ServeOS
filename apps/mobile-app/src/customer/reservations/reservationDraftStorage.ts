import AsyncStorage from "@react-native-async-storage/async-storage";
import { authScope } from "../../data/cache/cacheKeys";
import { fetchReservationDraft, patchReservationDraft } from "./reservationApi";
import { ACCESSIBILITY_CARD_OPTIONS, EXPERIENCE_CARD_OPTIONS } from "./reservationPresets";
import { mergedExperiencePickIds } from "./experiencePickIds";
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
  confirmedReservationId?: string | null;
  updatedAt: number;
};

export type ReservationFlowSync = {
  authToken?: string | null;
};

const memory = new Map<string, PersistedReservationFlow>();

function storageKey(scope: string, restaurantId: string): string {
  const rid = restaurantId.trim() || "_none";
  return `${scope}:reservation:flow:${rid}`;
}

const ACCESSIBILITY_IDS = new Set(ACCESSIBILITY_CARD_OPTIONS.map((o) => o.id));
const EXPERIENCE_IDS = new Set(EXPERIENCE_CARD_OPTIONS.map((o) => o.id));

function normalizeAccessibilityNoteIds(raw: Record<string, unknown>): string[] {
  if (Array.isArray(raw.accessibilityNoteIds)) {
    const ids = raw.accessibilityNoteIds.filter(
      (id): id is string => typeof id === "string" && ACCESSIBILITY_IDS.has(id)
    );
    return [...new Set(ids)];
  }
  const legacy =
    typeof raw.accessibilityNotes === "string" ? raw.accessibilityNotes.trim() : "";
  if (!legacy) return [];
  const match = ACCESSIBILITY_CARD_OPTIONS.find((o) => o.label === legacy);
  return match ? [match.id] : [];
}

function normalizeDraft(raw: unknown): ReservationDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const guests = typeof o.guests === "number" && o.guests >= 1 ? o.guests : null;
  const dateLabel = typeof o.dateLabel === "string" ? o.dateLabel.trim() : "";
  const timeLabel = typeof o.timeLabel === "string" ? o.timeLabel.trim() : "";
  if (!guests || !dateLabel || !timeLabel) return null;

  const branchId = typeof o.branchId === "string" ? o.branchId : null;
  const rawQuickPickIds = Array.isArray(o.quickPickIds)
    ? o.quickPickIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const quickPickIds = mergedExperiencePickIds({ branchId, quickPickIds: rawQuickPickIds }).filter((id) =>
    EXPERIENCE_IDS.has(id)
  );

  return {
    ...EMPTY_RESERVATION_DRAFT,
    branchId: null,
    quickDateId: typeof o.quickDateId === "string" ? o.quickDateId : null,
    quickPickIds,
    guests,
    dateLabel,
    timeLabel,
    seatingPreference: typeof o.seatingPreference === "string" ? o.seatingPreference : null,
    occasion: typeof o.occasion === "string" ? o.occasion : null,
    accessibilityNoteIds: normalizeAccessibilityNoteIds(o),
    restaurantNote: typeof o.restaurantNote === "string" ? o.restaurantNote : "",
    tableId: typeof o.tableId === "string" ? o.tableId : null,
    slotLabel: typeof o.slotLabel === "string" ? o.slotLabel : null,
  };
}

const SCREEN_IDS = new Set<ReservationScreenId>([
  "landing",
  "builder",
  "availability",
  "confirmation",
  "management",
  "group_event"
]);

function normalizeScreen(raw: unknown): ReservationScreenId {
  if (typeof raw !== "string") return "landing";
  if (raw === "checkout") return "availability";
  return SCREEN_IDS.has(raw as ReservationScreenId) ? (raw as ReservationScreenId) : "landing";
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

function flowFromServerPayload(flow: {
  draft: Record<string, unknown>;
  screen: string;
  scrollByScreen?: Record<string, number>;
  confirmedReservationId?: string | null;
  updatedAt: string;
}): PersistedReservationFlow | null {
  const draft = normalizeDraft(flow.draft);
  if (!draft) return null;
  const screen = normalizeScreen(flow.screen);
  const confirmedReservationId =
    typeof flow.confirmedReservationId === "string" && flow.confirmedReservationId.trim()
      ? flow.confirmedReservationId.trim()
      : null;
  if (screen === "confirmation" && !confirmedReservationId) return null;
  return {
    draft,
    screen,
    scrollByScreen: normalizeScrollByScreen(flow.scrollByScreen),
    confirmedReservationId,
    updatedAt: Date.parse(flow.updatedAt) || Date.now()
  };
}

export async function loadReservationFlow(
  userId: string | null | undefined,
  restaurantId: string,
  sync?: ReservationFlowSync
): Promise<PersistedReservationFlow | null> {
  const rid = restaurantId.trim();
  const tok = sync?.authToken?.trim();
  if (userId && tok && rid) {
    try {
      const res = await fetchReservationDraft(tok, rid);
      if (res.ok && res.flow) {
        const state = flowFromServerPayload(res.flow);
        if (state) {
          writeReservationFlowMemory(userId, restaurantId, state);
          return state;
        }
      }
    } catch {
      /* fall through to local cache */
    }
  }

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
      confirmedReservationId?: unknown;
    };
    const draft = normalizeDraft(parsed.draft);
    if (!draft) return null;
    const screen = normalizeScreen(parsed.screen);
    const confirmedReservationId =
      typeof parsed.confirmedReservationId === "string" && parsed.confirmedReservationId.trim()
        ? parsed.confirmedReservationId.trim()
        : null;
    if (screen === "confirmation" && !confirmedReservationId) {
      return null;
    }
    const state: PersistedReservationFlow = {
      draft,
      screen,
      scrollByScreen: normalizeScrollByScreen(parsed.scrollByScreen),
      confirmedReservationId,
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
  state: PersistedReservationFlow,
  sync?: ReservationFlowSync
): Promise<void> {
  writeReservationFlowMemory(userId, restaurantId, state);
  try {
    await AsyncStorage.setItem(
      storageKey(authScope(userId), restaurantId),
      JSON.stringify({
        draft: state.draft,
        screen: state.screen,
        scrollByScreen: state.scrollByScreen,
        confirmedReservationId: state.confirmedReservationId ?? null
      })
    );
  } catch {
    /* best-effort */
  }

  const tok = sync?.authToken?.trim();
  const rid = restaurantId.trim();
  if (userId && tok && rid) {
    void patchReservationDraft(tok, rid, {
      draft: state.draft,
      screen: state.screen,
      scrollByScreen: state.scrollByScreen,
      confirmedReservationId: state.confirmedReservationId ?? null
    }).catch(() => {});
  }
}
