import { useEffect, useState } from "react";
import { readAdminTheme, type AdminTheme } from "../admin/adminNavContent";
import type { FabTone } from "./fabTone";

export function fabToneForAdminTheme(theme: AdminTheme): FabTone {
  return theme === "light" ? "dark" : "light";
}

export function useAdminWorkspaceFabTone(active: boolean): FabTone {
  const [tone, setTone] = useState<FabTone>(() => (active ? fabToneForAdminTheme(readAdminTheme()) : "dark"));

  useEffect(() => {
    if (!active) return;
    const sync = () => setTone(fabToneForAdminTheme(readAdminTheme()));
    sync();
    const shell = document.querySelector(".admin-shell");
    if (!shell) return;
    const obs = new MutationObserver(sync);
    obs.observe(shell, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [active]);

  return tone;
}
