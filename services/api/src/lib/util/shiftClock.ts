import { getUpstashRedis } from "@serveos/core-upstash";

export type ShiftClockState = {
  clockedIn: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  breakStartedAt: string | null;
};

const memory = new Map<string, ShiftClockState>();

function key(userId: string, restaurantId: string) {
  return `shift:${userId}:${restaurantId}`;
}

async function readState(userId: string, restaurantId: string): Promise<ShiftClockState> {
  const redis = getUpstashRedis();
  const k = key(userId, restaurantId);
  if (redis) {
    const raw = await redis.get<string>(k);
    if (raw) {
      try {
        return JSON.parse(raw) as ShiftClockState;
      } catch {
        /* fall through */
      }
    }
  } else if (memory.has(k)) {
    return memory.get(k)!;
  }
  return { clockedIn: false, clockInAt: null, clockOutAt: null, breakStartedAt: null };
}

async function writeState(userId: string, restaurantId: string, state: ShiftClockState) {
  const redis = getUpstashRedis();
  const k = key(userId, restaurantId);
  const payload = JSON.stringify(state);
  if (redis) {
    await redis.set(k, payload, { ex: 60 * 60 * 24 * 14 });
  } else {
    memory.set(k, state);
  }
}

export async function getShiftClock(userId: string, restaurantId: string) {
  return readState(userId, restaurantId);
}

export async function clockInShift(userId: string, restaurantId: string) {
  const now = new Date().toISOString();
  const state: ShiftClockState = {
    clockedIn: true,
    clockInAt: now,
    clockOutAt: null,
    breakStartedAt: null
  };
  await writeState(userId, restaurantId, state);
  return state;
}

export async function clockOutShift(userId: string, restaurantId: string) {
  const prev = await readState(userId, restaurantId);
  const now = new Date().toISOString();
  const state: ShiftClockState = {
    clockedIn: false,
    clockInAt: prev.clockInAt,
    clockOutAt: now,
    breakStartedAt: null
  };
  await writeState(userId, restaurantId, state);
  return state;
}

export async function toggleBreakShift(userId: string, restaurantId: string) {
  const prev = await readState(userId, restaurantId);
  if (!prev.clockedIn) {
    throw Object.assign(new Error("not_clocked_in"), { statusCode: 400 });
  }
  const state: ShiftClockState = {
    ...prev,
    breakStartedAt: prev.breakStartedAt ? null : new Date().toISOString()
  };
  await writeState(userId, restaurantId, state);
  return state;
}
