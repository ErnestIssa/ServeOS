import { useCallback, useEffect, useState } from "react";
import { getMenuCapabilities, type MenuCapabilitiesPayload } from "../../api";

export function useMenuCapabilities(token: string | null, restaurantId: string | null) {
  const [capabilities, setCapabilities] = useState<MenuCapabilitiesPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !restaurantId) {
      setCapabilities(null);
      return;
    }
    setLoading(true);
    const res = await getMenuCapabilities(token, restaurantId);
    setLoading(false);
    if (res.ok && res.capabilities) setCapabilities(res.capabilities);
  }, [token, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const can = useCallback(
    (entity: keyof MenuCapabilitiesPayload["entities"], action: string) => {
      return Boolean(capabilities?.entities?.[entity]?.[action as never]);
    },
    [capabilities]
  );

  return { capabilities, loading, can, refresh: reload };
}
