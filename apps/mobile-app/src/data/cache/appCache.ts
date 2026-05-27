import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "serveos.cache.v1.";

type CacheEntry<T> = {
  data: T;
  updatedAt: number;
  ttlMs: number;
};

const memory = new Map<string, CacheEntry<unknown>>();

function isFresh<T>(entry: CacheEntry<T>, now = Date.now()): boolean {
  return now - entry.updatedAt <= entry.ttlMs;
}

export type CacheReadResult<T> = {
  data: T;
  /** True when data is older than TTL but still returned for instant UI. */
  stale: boolean;
};

export function cacheReadMemory<T>(key: string): CacheReadResult<T> | null {
  const hit = memory.get(key) as CacheEntry<T> | undefined;
  if (!hit) return null;
  return { data: hit.data, stale: !isFresh(hit) };
}

export async function cacheRead<T>(key: string): Promise<CacheReadResult<T> | null> {
  const mem = cacheReadMemory<T>(key);
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed !== "object" || parsed.data === undefined) return null;
    memory.set(key, parsed);
    return { data: parsed.data, stale: !isFresh(parsed) };
  } catch {
    return null;
  }
}

export async function cacheWrite<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const entry: CacheEntry<T> = { data, updatedAt: Date.now(), ttlMs };
  memory.set(key, entry);
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* Quota or serialization — memory layer still helps this session. */
  }
}

export function cacheInvalidateMemory(prefix: string): void {
  for (const k of memory.keys()) {
    if (k.startsWith(prefix)) memory.delete(k);
  }
}

export async function cacheInvalidate(prefix: string): Promise<void> {
  cacheInvalidateMemory(prefix);
  try {
    const all = await AsyncStorage.getAllKeys();
    const targets = all.filter((k) => k.startsWith(STORAGE_PREFIX + prefix));
    if (targets.length) await AsyncStorage.multiRemove(targets);
  } catch {
    /* ignore */
  }
}

export type FetchWithCacheOptions<T> = {
  /** Skip cache read; still writes fresh result. */
  force?: boolean;
  /** Called synchronously when cached data is available (before network). */
  onCached?: (data: T) => void;
};

/**
 * Stale-while-revalidate: returns cached data immediately when present,
 * always fetches in background unless `force` and cache is fresh.
 */
export async function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  opts?: FetchWithCacheOptions<T>
): Promise<T> {
  const force = opts?.force === true;
  let cached: CacheReadResult<T> | null = null;

  if (!force) {
    cached = cacheReadMemory(key) ?? (await cacheRead<T>(key));
    if (cached) opts?.onCached?.(cached.data);
  }

  const shouldFetch = force || !cached || cached.stale;
  if (!shouldFetch && cached) return cached.data;

  const fresh = await fetcher();
  await cacheWrite(key, fresh, ttlMs);
  return fresh;
}

/** Fire-and-forget revalidate (does not block UI). */
export function revalidateInBackground<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onFresh?: (data: T) => void
): void {
  void (async () => {
    try {
      const fresh = await fetcher();
      await cacheWrite(key, fresh, ttlMs);
      onFresh?.(fresh);
    } catch {
      /* silent */
    }
  })();
}
