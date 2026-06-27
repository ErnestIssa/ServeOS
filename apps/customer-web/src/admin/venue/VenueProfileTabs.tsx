import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AdminBtnPrimary, AdminBtnSecondary, AdminCopyField, AdminEmptyState } from "../AdminUi";
import { ADMIN_TOP_HASHES } from "../adminTopHashes";
import { buildNavHref } from "../adminWorkspaceRouting";
import { useAdminToast } from "../AdminToast";
import type { VenueProfileAccess } from "./venueProfileAccess";
import {
  computeSetupProgress,
  DAY_LABELS,
  missingRequiredSetup,
  type DayKey,
  type VenueProfileSettings,
  type VenueProfileTab
} from "./venueProfileModel";
import {
  ConfirmVenueActionModal,
  CreateLocationModal,
  SpecialHoursModal,
  VenueProfileSheet
} from "./VenueProfileModals";
import {
  VenueFieldGrid,
  VenueFormField,
  VenuePermissionGate,
  VenueReadOnlyRow,
  VenueSection,
  VenueSelectField,
  VenueToggleRow
} from "./VenueProfileUi";
import type { VenueListRow } from "./useVenueProfile";

const TAB_MOTION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

type TabProps = {
  tab: VenueProfileTab;
  venueId: string;
  displayName: string;
  companyId: string | null;
  venues: VenueListRow[];
  settings: VenueProfileSettings;
  access: VenueProfileAccess;
  persist: (next: VenueProfileSettings | ((p: VenueProfileSettings) => VenueProfileSettings)) => void;
  onSelectVenue?: (id: string) => void;
  createLocation: (name: string) => Promise<{ ok: boolean; error?: string; id?: string }>;
};

function roleLabel(role: string) {
  return role.replace(/_/g, " ");
}

export function VenueProfileTabContent(props: TabProps) {
  const { tab } = props;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={TAB_MOTION}
      >
        {tab === "overview" ? <OverviewTab {...props} /> : null}
        {tab === "profile" ? <ProfileBusinessTab {...props} /> : null}
        {tab === "locations" ? <LocationsTab {...props} /> : null}
        {tab === "hours" ? <HoursTab {...props} /> : null}
        {tab === "dining" ? <DiningTab {...props} /> : null}
        {tab === "notifications" ? <NotificationsTab {...props} /> : null}
        {tab === "advanced" ? <AdvancedTab {...props} /> : null}
      </motion.div>
    </AnimatePresence>
  );
}

function OverviewTab({ displayName, venueId, companyId, settings, access, persist }: TabProps) {
  const { pushToast } = useAdminToast();
  const progress = useMemo(() => computeSetupProgress(settings), [settings]);
  const missing = useMemo(() => missingRequiredSetup(settings), [settings]);

  const connected = [
    { label: "Menu", ok: true, href: buildNavHref("config", "menu") },
    { label: "Staff", ok: true, href: ADMIN_TOP_HASHES.addStaff },
    { label: "Payments", ok: false, href: buildNavHref("config", "payments") },
    { label: "Orders", ok: true, href: buildNavHref("orders", "active-orders") }
  ];

  return (
    <div className="admin-venue-tab-stack">
      <div className="admin-venue-hero-card">
        <p className="admin-venue-hero-kicker">Restaurant</p>
        <h2 className="admin-venue-hero-title">{displayName}</h2>
        <p className="admin-venue-hero-desc">Everything about the venue itself — identity, hours, dining modes, and operational health.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminCopyField label="Venue ID" value={venueId} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
          <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">Setup progress</p>
          <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{progress.percent}%</p>
          <p className="admin-stat-hint mt-1 text-xs">
            {progress.done} of {progress.total} required items
          </p>
        </div>
        <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
          <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">Missing required</p>
          <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{missing.length}</p>
          <p className="admin-stat-hint mt-1 text-xs">Before go-live checklist</p>
        </div>
        <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
          <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">Your role</p>
          <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{roleLabel(access.role)}</p>
          <p className="admin-stat-hint mt-1 text-xs">Permission scope</p>
        </div>
        <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
          <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">Venue status</p>
          <p className="admin-stat-value mt-2 font-display text-2xl font-bold capitalize">{settings.advanced.status}</p>
          <p className="admin-stat-hint mt-1 text-xs">Ordering & maintenance</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <VenueSection title="Missing required setup" description="Complete these before guests rely on this venue.">
          {missing.length === 0 ? (
            <p className="admin-venue-text-subtle text-sm">All required setup items are complete.</p>
          ) : (
            <ul className="admin-venue-checklist">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </VenueSection>

        <VenueSection title="Connected services" description="Modules linked to this venue.">
          <ul className="admin-venue-service-list">
            {connected.map((s) => (
              <li key={s.label}>
                <a href={s.href} className="admin-venue-service-row">
                  <span className="font-semibold admin-venue-text">{s.label}</span>
                  <span className={`admin-venue-chip${s.ok ? " admin-venue-chip--success" : ""}`}>{s.ok ? "Connected" : "Setup"}</span>
                </a>
              </li>
            ))}
          </ul>
        </VenueSection>
      </div>

      <VenueSection title="Configuration health" description="Snapshot of profile completeness and risk flags.">
        <div className="admin-venue-health-bar">
          <div className="admin-venue-health-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <VenueReadOnlyRow label="Contact email" value={settings.profile.contactEmail} />
          <VenueReadOnlyRow label="Phone" value={settings.profile.phone} />
          <VenueReadOnlyRow label="Address" value={[settings.address.street, settings.address.city].filter(Boolean).join(", ")} />
          <VenueReadOnlyRow label="Company ID" value={companyId ?? "—"} />
        </div>
      </VenueSection>

      <VenueSection title="Quick actions" description="Jump to the most common venue tasks.">
        <div className="flex flex-wrap gap-2">
          <a href={buildNavHref("config", "menu")} className="admin-copy-btn">
            Edit menu
          </a>
          <a href={ADMIN_TOP_HASHES.addStaff} className="admin-copy-btn">
            Manage staff
          </a>
          <button type="button" className="admin-copy-btn" onClick={() => pushToast("Opening hours tab — use the tabs above.", "success")}>
            Opening hours
          </button>
          <VenuePermissionGate access={access} action="editProfile">
            <button
              type="button"
              className="admin-copy-btn"
              onClick={() =>
                persist((p) => ({
                  ...p,
                  profile: { ...p.profile, description: p.profile.description || "Welcome to our venue." }
                }))
              }
            >
              Fill description draft
            </button>
          </VenuePermissionGate>
        </div>
      </VenueSection>
    </div>
  );
}

function ProfileBusinessTab({ settings, access, persist }: TabProps) {
  const canEditProfile = access.can("editProfile");
  const canEditBusiness = access.can("editBusiness");
  const { profile, business, address } = settings;

  const patch = (section: "profile" | "business" | "address", key: string, value: string) => {
    persist((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
  };

  return (
    <div className="admin-venue-tab-stack">
      <VenueSection title="Venue profile" description="Guest-facing identity and contact surfaces.">
        <VenuePermissionGate access={access} action="editProfile">
          <VenueFieldGrid>
            <VenueFormField label="Venue name" value={profile.venueName} readOnly={!canEditProfile} onChange={(v) => patch("profile", "venueName", v)} />
            <VenueFormField label="Legal business name" value={profile.legalBusinessName} readOnly={!canEditProfile} onChange={(v) => patch("profile", "legalBusinessName", v)} />
            <VenueFormField label="Brand name" value={profile.brandName} readOnly={!canEditProfile} onChange={(v) => patch("profile", "brandName", v)} />
            <VenueFormField
              label="Cuisine types"
              value={profile.cuisineTypes.join(", ")}
              readOnly={!canEditProfile}
              placeholder="Burgers, Pizza, Swedish"
              onChange={(v) =>
                persist((p) => ({
                  ...p,
                  profile: {
                    ...p.profile,
                    cuisineTypes: v.split(",").map((s) => s.trim()).filter(Boolean)
                  }
                }))
              }
            />
            <VenueFormField label="Venue description" value={profile.description} readOnly={!canEditProfile} onChange={(v) => patch("profile", "description", v)} />
            <VenueFormField label="Contact email" value={profile.contactEmail} readOnly={!canEditProfile} type="email" onChange={(v) => patch("profile", "contactEmail", v)} />
            <VenueFormField label="Phone number" value={profile.phone} readOnly={!canEditProfile} onChange={(v) => patch("profile", "phone", v)} />
            <VenueFormField label="Website" value={profile.website} readOnly={!canEditProfile} onChange={(v) => patch("profile", "website", v)} />
            <VenueFormField label="Instagram" value={profile.socialInstagram} readOnly={!canEditProfile} onChange={(v) => patch("profile", "socialInstagram", v)} />
            <VenueFormField label="Facebook" value={profile.socialFacebook} readOnly={!canEditProfile} onChange={(v) => patch("profile", "socialFacebook", v)} />
            <VenueFormField label="TikTok" value={profile.socialTiktok} readOnly={!canEditProfile} onChange={(v) => patch("profile", "socialTiktok", v)} />
          </VenueFieldGrid>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="admin-venue-media-slot">
              <p className="admin-venue-field-label">Logo</p>
              <p className="admin-venue-text-subtle mt-2 text-sm">Upload via media API when editing is enabled for your role.</p>
              <AdminBtnSecondary className="mt-3" disabled={!canEditProfile}>
                Upload logo
              </AdminBtnSecondary>
            </div>
            <div className="admin-venue-media-slot">
              <p className="admin-venue-field-label">Cover image</p>
              <p className="admin-venue-text-subtle mt-2 text-sm">Hero image for guest ordering surfaces.</p>
              <AdminBtnSecondary className="mt-3" disabled={!canEditProfile}>
                Upload cover
              </AdminBtnSecondary>
            </div>
          </div>
        </VenuePermissionGate>
      </VenueSection>

      <VenueSection title="Business information" description="Legal, tax, and regional defaults.">
        <VenuePermissionGate access={access} action="editBusiness">
          <VenueFieldGrid>
            <VenueFormField label="Organization number" value={business.organizationNumber} readOnly={!canEditBusiness} mono onChange={(v) => patch("business", "organizationNumber", v)} />
            <VenueFormField label="VAT number" value={business.vatNumber} readOnly={!canEditBusiness} mono onChange={(v) => patch("business", "vatNumber", v)} />
            <VenueFormField label="Tax ID" value={business.taxId} readOnly={!canEditBusiness} mono onChange={(v) => patch("business", "taxId", v)} />
            <VenueSelectField
              label="Currency"
              value={business.currency}
              readOnly={!canEditBusiness}
              onChange={(v) => patch("business", "currency", v)}
              options={[
                { value: "SEK", label: "SEK" },
                { value: "EUR", label: "EUR" },
                { value: "USD", label: "USD" },
                { value: "GBP", label: "GBP" }
              ]}
            />
            <VenueSelectField
              label="Default language"
              value={business.language}
              readOnly={!canEditBusiness}
              onChange={(v) => patch("business", "language", v)}
              options={[
                { value: "sv", label: "Swedish" },
                { value: "en", label: "English" },
                { value: "no", label: "Norwegian" }
              ]}
            />
            <VenueFormField label="Timezone" value={business.timezone} readOnly={!canEditBusiness} onChange={(v) => patch("business", "timezone", v)} />
          </VenueFieldGrid>
        </VenuePermissionGate>
      </VenueSection>

      <VenueSection title="Address" description="Physical location and future delivery radius.">
        <VenuePermissionGate access={access} action="editBusiness">
          <VenueFieldGrid>
            <VenueFormField label="Street" value={address.street} readOnly={!canEditBusiness} onChange={(v) => patch("address", "street", v)} />
            <VenueFormField label="Postal code" value={address.postalCode} readOnly={!canEditBusiness} onChange={(v) => patch("address", "postalCode", v)} />
            <VenueFormField label="City" value={address.city} readOnly={!canEditBusiness} onChange={(v) => patch("address", "city", v)} />
            <VenueFormField label="Country" value={address.country} readOnly={!canEditBusiness} onChange={(v) => patch("address", "country", v)} />
            <VenueFormField label="GPS latitude" value={address.gpsLat} readOnly={!canEditBusiness} mono onChange={(v) => patch("address", "gpsLat", v)} />
            <VenueFormField label="GPS longitude" value={address.gpsLng} readOnly={!canEditBusiness} mono onChange={(v) => patch("address", "gpsLng", v)} />
            <VenueFormField label="Delivery radius (km)" value={address.deliveryRadiusKm} readOnly placeholder="Future" onChange={(v) => patch("address", "deliveryRadiusKm", v)} />
          </VenueFieldGrid>
        </VenuePermissionGate>
      </VenueSection>
    </div>
  );
}

function LocationsTab({ venues, venueId, access, onSelectVenue, createLocation }: TabProps) {
  const { pushToast } = useAdminToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [sheetVenue, setSheetVenue] = useState<VenueListRow | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="admin-venue-tab-stack">
      <VenueSection
        title="Locations (multi-location)"
        description="View, create, and manage venues in your workspace."
        action={
          <VenuePermissionGate access={access} action="createLocation" fallback={null}>
            <AdminBtnPrimary type="button" onClick={() => setCreateOpen(true)}>
              Create location
            </AdminBtnPrimary>
          </VenuePermissionGate>
        }
      >
        {venues.length === 0 ? (
          <AdminEmptyState>No locations yet.</AdminEmptyState>
        ) : (
          <ul className="admin-venue-location-list divide-y divide-[var(--admin-border)]">
            {venues.map((v) => {
              const isActive = v.id === venueId;
              const canSelect = (v.status ?? "ACTIVE").toUpperCase() === "ACTIVE";
              return (
                <li key={v.id} className={`admin-venue-location-row${isActive ? " admin-venue-location-row--active" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold admin-venue-text">{v.name}</p>
                    <code className="admin-venue-id-pill mt-2">{v.id}</code>
                    <p className="admin-venue-text-subtle mt-2 text-xs">Role: {roleLabel(v.role)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminBtnSecondary type="button" onClick={() => setSheetVenue(v)}>
                      {access.can("editLocation") ? "Edit" : "View"}
                    </AdminBtnSecondary>
                    {isActive ? (
                      <span className="admin-venue-chip admin-venue-chip--violet">Active</span>
                    ) : canSelect && onSelectVenue ? (
                      <AdminBtnSecondary type="button" onClick={() => onSelectVenue(v.id)}>
                        Switch
                      </AdminBtnSecondary>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </VenueSection>

      <CreateLocationModal
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onConfirm={async (name) => {
          setBusy(true);
          const res = await createLocation(name);
          setBusy(false);
          if (res.ok) pushToast(`Location "${name}" created.`, "success");
          return res;
        }}
      />

      <VenueProfileSheet
        open={Boolean(sheetVenue)}
        title={sheetVenue?.name ?? "Location"}
        description="Location managers, opening date, and location-specific settings."
        onClose={() => setSheetVenue(null)}
        footer={
          <VenuePermissionGate access={access} action="disableLocation">
            <AdminBtnSecondary
              type="button"
              onClick={() => {
                pushToast("Disable location will connect to venue lifecycle APIs.", "success");
                setSheetVenue(null);
              }}
            >
              Disable location
            </AdminBtnSecondary>
          </VenuePermissionGate>
        }
      >
        {sheetVenue ? (
          <VenueFieldGrid>
            <AdminCopyField label="Location ID" value={sheetVenue.id} />
            <VenueReadOnlyRow label="Your role" value={roleLabel(sheetVenue.role)} />
            <VenueFormField label="Location manager" value="" placeholder="Assign manager" readOnly={!access.can("editLocation")} />
            <VenueFormField label="Opening date" value="" type="date" readOnly={!access.can("editLocation")} />
            <VenueFormField label="Timezone override" value="Use venue default" readOnly={!access.can("editLocation")} />
          </VenueFieldGrid>
        ) : null}
      </VenueProfileSheet>
    </div>
  );
}

function HoursTab({ settings, access, persist }: TabProps) {
  const [specialOpen, setSpecialOpen] = useState(false);
  const canEdit = access.can("editHours");

  const setDay = (day: DayKey, patch: Partial<(typeof settings.hours.weekly)[DayKey]>) => {
    persist((p) => ({
      ...p,
      hours: { ...p.hours, weekly: { ...p.hours.weekly, [day]: { ...p.hours.weekly[day], ...patch } } }
    }));
  };

  return (
    <div className="admin-venue-tab-stack">
      <VenueSection title="Weekly schedule" description="Regular service hours for each day.">
        <VenuePermissionGate access={access} action="editHours">
          <ul className="admin-venue-hours-list">
            {(Object.keys(DAY_LABELS) as DayKey[]).map((day) => {
              const row = settings.hours.weekly[day];
              return (
                <li key={day} className="admin-venue-hours-row">
                  <span className="admin-venue-hours-day">{DAY_LABELS[day]}</span>
                  <VenueToggleRow label="Closed" checked={row.closed} disabled={!canEdit} onChange={(closed) => setDay(day, { closed })} />
                  <VenueFormField label="Open" value={row.open} readOnly={!canEdit || row.closed} type="time" onChange={(v) => setDay(day, { open: v })} />
                  <VenueFormField label="Close" value={row.close} readOnly={!canEdit || row.closed} type="time" onChange={(v) => setDay(day, { close: v })} />
                </li>
              );
            })}
          </ul>
        </VenuePermissionGate>
      </VenueSection>

      <VenueSection
        title="Special hours"
        description="Holidays, temporary closures, vacation, and special events."
        action={
          <VenuePermissionGate access={access} action="editHours" fallback={null}>
            <AdminBtnPrimary type="button" onClick={() => setSpecialOpen(true)}>
              Add special
            </AdminBtnPrimary>
          </VenuePermissionGate>
        }
      >
        {settings.hours.specials.length === 0 ? (
          <AdminEmptyState>No special schedules yet.</AdminEmptyState>
        ) : (
          <ul className="admin-venue-special-list">
            {settings.hours.specials.map((s) => (
              <li key={s.id} className="admin-venue-special-row">
                <div>
                  <p className="font-semibold admin-venue-text">{s.label}</p>
                  <p className="admin-venue-text-subtle text-xs capitalize">
                    {s.kind} · {s.startDate}
                    {s.endDate !== s.startDate ? ` – ${s.endDate}` : ""}
                  </p>
                  {s.note ? <p className="admin-venue-text-muted mt-1 text-sm">{s.note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </VenueSection>

      <SpecialHoursModal
        open={specialOpen}
        onClose={() => setSpecialOpen(false)}
        onSave={(row) => persist((p) => ({ ...p, hours: { ...p.hours, specials: [...p.hours.specials, row] } }))}
      />
    </div>
  );
}

function DiningTab({ settings, access, persist }: TabProps) {
  const canDining = access.can("editDining");
  const canTables = access.can("editTables");
  const canReceipt = access.can("editReceipt");
  const canBrand = access.can("editBranding");

  return (
    <div className="admin-venue-tab-stack">
      <VenueSection title="Dining settings" description="Which service modes guests can use.">
        <VenuePermissionGate access={access} action="editDining">
          <div className="admin-venue-toggle-stack">
            <VenueToggleRow label="Dine-in enabled" checked={settings.dining.dineIn} disabled={!canDining} onChange={(v) => persist((p) => ({ ...p, dining: { ...p.dining, dineIn: v } }))} />
            <VenueToggleRow label="Takeaway enabled" checked={settings.dining.takeaway} disabled={!canDining} onChange={(v) => persist((p) => ({ ...p, dining: { ...p.dining, takeaway: v } }))} />
            <VenueToggleRow label="Delivery enabled" checked={settings.dining.delivery} disabled={!canDining} onChange={(v) => persist((p) => ({ ...p, dining: { ...p.dining, delivery: v } }))} />
            <VenueToggleRow label="QR ordering enabled" checked={settings.dining.qrOrdering} disabled={!canDining} onChange={(v) => persist((p) => ({ ...p, dining: { ...p.dining, qrOrdering: v } }))} />
            <VenueToggleRow label="Reservations enabled" checked={settings.dining.reservations} disabled={!canDining} onChange={(v) => persist((p) => ({ ...p, dining: { ...p.dining, reservations: v } }))} />
            <VenueToggleRow label="Walk-ins enabled" checked={settings.dining.walkIns} disabled={!canDining} onChange={(v) => persist((p) => ({ ...p, dining: { ...p.dining, walkIns: v } }))} />
          </div>
        </VenuePermissionGate>
      </VenueSection>

      <VenueSection title="Table settings" description="Floor map metadata and QR assignment.">
        <VenuePermissionGate access={access} action="editTables">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="admin-venue-text-subtle text-sm">{settings.tables.rows.length} tables configured</p>
            <AdminBtnSecondary
              type="button"
              disabled={!canTables}
              onClick={() =>
                persist((p) => ({
                  ...p,
                  tables: {
                    rows: [
                      ...p.tables.rows,
                      { id: `t-${Date.now()}`, name: `Table ${p.tables.rows.length + 1}`, capacity: 2, group: "Main floor", qrAssigned: false }
                    ]
                  }
                }))
              }
            >
              Add table
            </AdminBtnSecondary>
          </div>
          <div className="admin-venue-table-wrap overflow-x-auto">
            <table className="admin-venue-data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Capacity</th>
                  <th>Group</th>
                  <th>QR</th>
                </tr>
              </thead>
              <tbody>
                {settings.tables.rows.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.capacity}</td>
                    <td>{t.group}</td>
                    <td>{t.qrAssigned ? "Assigned" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VenuePermissionGate>
      </VenueSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <VenueSection title="Receipt settings" description="Printed and emailed receipt defaults.">
          <VenuePermissionGate access={access} action="editReceipt">
            <VenueFieldGrid>
              <VenueFormField label="Receipt footer" value={settings.receipt.footer} readOnly={!canReceipt} onChange={(v) => persist((p) => ({ ...p, receipt: { ...p.receipt, footer: v } }))} />
              <VenueFormField label="Thank-you message" value={settings.receipt.thankYou} readOnly={!canReceipt} onChange={(v) => persist((p) => ({ ...p, receipt: { ...p.receipt, thankYou: v } }))} />
            </VenueFieldGrid>
            <div className="admin-venue-toggle-stack mt-4">
              <VenueToggleRow label="Show VAT on receipt" checked={settings.receipt.showVat} disabled={!canReceipt} onChange={(v) => persist((p) => ({ ...p, receipt: { ...p.receipt, showVat: v } }))} />
              <VenueToggleRow label="Print logo" checked={settings.receipt.printLogo} disabled={!canReceipt} onChange={(v) => persist((p) => ({ ...p, receipt: { ...p.receipt, printLogo: v } }))} />
              <VenueToggleRow label="Email receipt by default" checked={settings.receipt.emailReceiptDefault} disabled={!canReceipt} onChange={(v) => persist((p) => ({ ...p, receipt: { ...p.receipt, emailReceiptDefault: v } }))} />
            </div>
          </VenuePermissionGate>
        </VenueSection>

        <VenueSection title="Branding" description="Colors and customer-facing brand notes.">
          <VenuePermissionGate access={access} action="editBranding">
            <VenueFieldGrid>
              <VenueFormField label="Primary color" value={settings.branding.primaryColor} readOnly={!canBrand} onChange={(v) => persist((p) => ({ ...p, branding: { ...p.branding, primaryColor: v } }))} />
              <VenueFormField label="Accent color" value={settings.branding.accentColor} readOnly={!canBrand} onChange={(v) => persist((p) => ({ ...p, branding: { ...p.branding, accentColor: v } }))} />
              <VenueFormField label="Customer branding note" value={settings.branding.customerBrandingNote} readOnly={!canBrand} onChange={(v) => persist((p) => ({ ...p, branding: { ...p.branding, customerBrandingNote: v } }))} />
            </VenueFieldGrid>
            <p className="admin-venue-text-subtle mt-3 text-xs">Custom fonts ship in a future release.</p>
          </VenuePermissionGate>
        </VenueSection>
      </div>
    </div>
  );
}

function NotificationsTab({ settings, access, persist }: TabProps) {
  const canEdit = access.can("editNotifications");
  const n = settings.notifications;

  const toggle = (key: keyof typeof n) => (value: boolean) =>
    persist((p) => ({ ...p, notifications: { ...p.notifications, [key]: value } }));

  return (
    <div className="admin-venue-tab-stack">
      <VenueSection title="Restaurant notification preferences" description="Choose what this venue sends to your team.">
        <div className="admin-venue-toggle-stack">
          <VenueToggleRow label="New orders" description="Kitchen and floor alerts for incoming orders." checked={n.newOrders} disabled={!canEdit} onChange={toggle("newOrders")} />
          <VenueToggleRow label="Refunds" description="Payment reversal and dispute signals." checked={n.refunds} disabled={!canEdit} onChange={toggle("refunds")} />
          <VenueToggleRow label="Staff invitations" description="Invite accepted, pending, or revoked." checked={n.staffInvitations} disabled={!canEdit} onChange={toggle("staffInvitations")} />
          <VenueToggleRow label="Reservations" description="New bookings and changes." checked={n.reservations} disabled={!canEdit} onChange={toggle("reservations")} />
          <VenueToggleRow label="Support alerts" description="Platform and operational escalations." checked={n.supportAlerts} disabled={!canEdit} onChange={toggle("supportAlerts")} />
        </div>
        {!canEdit ? <p className="admin-venue-locked-hint mt-4">{access.reason("editNotifications")}</p> : null}
      </VenueSection>
    </div>
  );
}

function AdvancedTab({ settings, access, persist }: TabProps) {
  const { pushToast } = useAdminToast();
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="admin-venue-tab-stack">
      <VenueSection title="Restaurant status" description="Operational modes that affect guest ordering.">
        <div className="admin-venue-toggle-stack">
          <VenueToggleRow
            label="Pause ordering"
            description="Stop new guest orders while keeping staff tools available."
            checked={settings.advanced.pauseOrdering}
            disabled={!access.can("pauseOrdering")}
            onChange={(v) => {
              persist((p) => ({
                ...p,
                advanced: { ...p.advanced, pauseOrdering: v, status: v ? "paused" : "open" }
              }));
              pushToast(v ? "Ordering paused for this venue." : "Ordering resumed.", "success");
            }}
          />
          <VenueToggleRow
            label="Maintenance mode"
            description="Show maintenance state to guests and limit checkout."
            checked={settings.advanced.maintenanceMode}
            disabled={!access.can("maintenanceMode")}
            onChange={(v) => {
              persist((p) => ({
                ...p,
                advanced: { ...p.advanced, maintenanceMode: v, status: v ? "maintenance" : p.advanced.pauseOrdering ? "paused" : "open" }
              }));
            }}
          />
        </div>
      </VenueSection>

      <VenueSection
        title="Archive venue"
        description="Permanently retire this location from active service. Owners only."
        action={
          <VenuePermissionGate access={access} action="archiveVenue" fallback={null}>
            <AdminBtnSecondary type="button" className="!border-rose-300 !text-rose-700" onClick={() => setArchiveOpen(true)}>
              Archive venue
            </AdminBtnSecondary>
          </VenuePermissionGate>
        }
      >
        <p className="admin-venue-text-subtle text-sm">
          Archiving requires verification and cannot be undone from this screen without support. Staff lose access; historical orders remain in reports.
        </p>
      </VenueSection>

      <ConfirmVenueActionModal
        open={archiveOpen}
        title="Archive this venue?"
        description="This action is restricted to owners and will be reviewed when venue lifecycle APIs are connected."
        confirmLabel="Request archive"
        danger
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => {
          pushToast("Archive request recorded locally — support review required.", "success");
          persist((p) => ({ ...p, advanced: { ...p.advanced, archived: true, status: "archived" } }));
          setArchiveOpen(false);
        }}
      />
    </div>
  );
}
