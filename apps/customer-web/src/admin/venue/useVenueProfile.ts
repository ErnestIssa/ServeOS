import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRestaurant, listRestaurants } from "../../api";
import { buildVenueProfileAccess, type VenueProfileAccess } from "./venueProfileAccess";
import {
  defaultVenueProfileSettings,
  loadVenueProfileSettings,
  saveVenueProfileSettings,
  type VenueProfileSettings
} from "./venueProfileModel";

export type VenueListRow = {
  id: string;
  name: string;
  role: string;
  status?: string;
  companyId?: string | null;
};

export function useVenueProfile(
  token: string | null,
  venueId: string,
  venueName: string
) {
  const [venues, setVenues] = useState<VenueListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [settings, setSettings] = useState<VenueProfileSettings>(() =>
    defaultVenueProfileSettings(venueName)
  );

  const active = useMemo(() => venues.find((v) => v.id === venueId), [venues, venueId]);

  const access: VenueProfileAccess = useMemo(
    () => buildVenueProfileAccess(active?.role ?? "STAFF"),
    [active?.role]
  );

  const reloadVenues = useCallback(async (opts?: { soft?: boolean }) => {
    if (!token) {
      setVenues([]);
      setReady(false);
      hasLoadedOnce.current = false;
      return;
    }
    const soft = Boolean(opts?.soft && hasLoadedOnce.current);
    if (!soft) setLoading(true);
    const res = await listRestaurants(token);
    if (!soft) setLoading(false);
    setReady(true);
    hasLoadedOnce.current = true;
    setVenues(res.ok && res.restaurants ? res.restaurants : []);
  }, [token]);

  useEffect(() => {
    void reloadVenues();
  }, [reloadVenues]);

  useEffect(() => {
    if (!venueId) return;
    const loaded = loadVenueProfileSettings(venueId, venueName);
    if (active?.name) {
      loaded.profile.venueName = active.name;
      if (!loaded.profile.brandName) loaded.profile.brandName = active.name;
    }
    setSettings(loaded);
  }, [venueId, venueName, active?.name]);

  const persist = useCallback(
    (next: VenueProfileSettings | ((prev: VenueProfileSettings) => VenueProfileSettings)) => {
      setSettings((prev) => {
        const merged = typeof next === "function" ? next(prev) : next;
        saveVenueProfileSettings(venueId, merged);
        return merged;
      });
    },
    [venueId]
  );

  const createLocation = useCallback(
    async (name: string) => {
      if (!token) return { ok: false as const, error: "Not signed in" };
      const res = await createRestaurant(token, {
        name: name.trim(),
        companyId: active?.companyId ?? undefined
      });
      if (!res.ok) return { ok: false as const, error: res.error ?? "Could not create location" };
      await reloadVenues();
      return { ok: true as const, id: res.restaurant?.id };
    },
    [token, active?.companyId, reloadVenues]
  );

  return {
    venues,
    active,
    access,
    settings,
    persist,
    createLocation,
    loading,
    ready,
    refreshing: loading && ready,
    initialLoading: loading && !ready,
    reload: reloadVenues
  };
}
