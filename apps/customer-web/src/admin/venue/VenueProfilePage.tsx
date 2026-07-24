import { useState } from "react";
import { AdminEmptyState, AdminPanel, AdminRefreshButton, AdminSectionHeader } from "../AdminUi";
import { AdminSkeletonStatGrid, AdminStaleContent } from "../AdminSkeleton";
import { ADMIN_VENUE_CONTROL_HASH } from "../adminTopHashes";
import { usePageRecoverySync, useSilentRevalidate } from "../sync/adminPageSync";
import { useVenueProfile } from "./useVenueProfile";
import { VENUE_PROFILE_TABS, type VenueProfileTab } from "./venueProfileModel";
import { VenueProfileTabContent } from "./VenueProfileTabs";

type Props = {
  venueName: string;
  venueId: string;
  token?: string | null;
  onSelectVenue?: (id: string) => void;
};

export function VenueProfilePage({ venueName, venueId, token = null, onSelectVenue }: Props) {
  const api = useVenueProfile(token, venueId, venueName);
  const [tab, setTab] = useState<VenueProfileTab>("overview");
  const displayName = (api.active?.name ?? venueName) || "Your venue";
  const companyId = api.active?.companyId ?? null;

  const { recover, recovering } = usePageRecoverySync([() => api.reload()]);
  useSilentRevalidate(() => api.reload({ soft: true }), {
    enabled: Boolean(token && venueId),
    minIntervalMs: 30_000,
    intervalMs: 90_000
  });

  if (!token || !venueId) {
    return (
      <AdminPanel id={ADMIN_VENUE_CONTROL_HASH.slice(1)} className="admin-top-page admin-panel--edge admin-venue-page">
        <AdminSectionHeader
          eyebrowText="Restaurant"
          title="Venue profile"
          description="Sign in and select a venue from the top bar to manage restaurant settings."
        />
        <div className="admin-venue-section-card mt-8 p-6">
          <AdminEmptyState>Select a venue using the store icon in the top navigation.</AdminEmptyState>
        </div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id={ADMIN_VENUE_CONTROL_HASH.slice(1)} className="admin-top-page admin-panel--edge admin-venue-page">
      <AdminSectionHeader
        eyebrowText="Restaurant"
        title={displayName}
        description="Everything about the venue itself — profile, locations, hours, dining, branding, and advanced controls."
        action={
          <AdminRefreshButton
            onRefresh={() => void recover()}
            refreshing={recovering || api.refreshing}
            label="Sync venue"
          />
        }
      />

      <nav className="admin-venue-tab-nav mt-6 flex flex-wrap gap-2" aria-label="Venue profile sections">
        {VENUE_PROFILE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-page-tab ${tab === t.id ? "admin-page-tab--active" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <AdminStaleContent refreshing={api.refreshing}>
        {api.initialLoading ? (
          <div className="mt-8">
            <AdminSkeletonStatGrid count={4} />
          </div>
        ) : (
          <div className="mt-6">
            <VenueProfileTabContent
              tab={tab}
              venueId={venueId}
              displayName={displayName}
              companyId={companyId}
              venues={api.venues}
              settings={api.settings}
              access={api.access}
              persist={api.persist}
              onSelectVenue={onSelectVenue}
              createLocation={api.createLocation}
              token={token}
            />
          </div>
        )}
      </AdminStaleContent>
    </AdminPanel>
  );
}

/** @deprecated Use VenueProfilePage — kept for existing imports */
export const AdminVenueControlCentrePage = VenueProfilePage;
