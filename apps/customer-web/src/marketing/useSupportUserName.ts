import { useEffect, useState } from "react";
import { fetchMe } from "../api";
import { readStoredAdminToken } from "../authStorage";
import { readUserDisplayName } from "../admin/adminNavContent";
import { formatSupportGreetingName } from "./supportPopupGreeting";

const DISPLAY_NAME_CACHE_KEY = "serveos.support.displayName";

function readCachedDisplayName(): string | null {
  try {
    return sessionStorage.getItem(DISPLAY_NAME_CACHE_KEY);
  } catch {
    return null;
  }
}

function cacheDisplayName(name: string) {
  try {
    sessionStorage.setItem(DISPLAY_NAME_CACHE_KEY, name);
  } catch {
    /* ignore */
  }
}

export function useSupportUserName(workspaceLocked: boolean, override?: string | null) {
  const [name, setName] = useState(() =>
    formatSupportGreetingName(override?.trim() || readCachedDisplayName() || "there")
  );

  useEffect(() => {
    if (override?.trim()) {
      setName(formatSupportGreetingName(override));
      return;
    }

    if (!workspaceLocked) {
      setName("there");
      return;
    }

    const cached = readCachedDisplayName();
    if (cached) setName(formatSupportGreetingName(cached));

    const token = readStoredAdminToken();
    if (!token) return;

    let cancelled = false;
    void (async () => {
      const res = await fetchMe(token);
      if (cancelled || !res.ok || !res.user) return;
      const resolved = readUserDisplayName({
        displayName: res.user.displayName,
        fullName: res.user.fullName,
        email: res.user.email,
        signupProfile: res.user.signupProfile
      });
      cacheDisplayName(resolved);
      if (!cancelled) setName(formatSupportGreetingName(resolved));
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceLocked, override]);

  return name;
}
