import { useEffect, useState } from "react";
import { readAdminHash } from "./adminNavContent";
import { ADMIN_NAV_SYNC_EVENT } from "./adminWorkspaceRouting";

export function useAdminHash() {
  const [hash, setHash] = useState(readAdminHash);

  useEffect(() => {
    const onHash = () => setHash(readAdminHash());
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ hash: string }>).detail;
      if (detail?.hash) setHash(detail.hash);
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener(ADMIN_NAV_SYNC_EVENT, onSync);
    onHash();
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener(ADMIN_NAV_SYNC_EVENT, onSync);
    };
  }, []);

  return hash;
}
