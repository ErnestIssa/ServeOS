import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "serveos.customer.navSearchRecent.v1";
const MAX = 8;

export async function loadNavSearchRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export async function appendNavSearchRecent(term: string): Promise<void> {
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    let prev: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) prev = parsed.filter((x): x is string => typeof x === "string");
    }
    const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
