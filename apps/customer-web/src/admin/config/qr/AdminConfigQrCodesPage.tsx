import { useCallback, useEffect, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  createQrCode,
  deactivateQrCode,
  duplicateQrCode,
  getQrCodeStats,
  listRestaurantMenus,
  listQrCodes,
  reactivateQrCode,
  rotateQrCode,
  updateQrCode,
  type CreateQrCodeBody,
  type MenuSurfaceRow,
  type QrCodeRow,
  type QrCodeType,
  type QrDashboardStats,
  type QrExperience,
  type QrPaymentMode
} from "../../../api";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader
} from "../../AdminUi";
import { AdminSkeletonStatGrid, AdminStaleContent } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import { useMenuCapabilities } from "../useMenuCapabilities";
import { CONFIG_PRESET_DESCRIPTIONS } from "../configRouting";
import { MenuSection, MenuToolbarButton } from "../menu/MenuPageUi";
import { MenuPageModalShell, ProfileModalAlert, ProfileModalFooter } from "../menu/menuPageModalShell";

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName?: string;
};

const TYPE_LABEL: Record<QrCodeType, string> = {
  TABLE: "Table",
  MENU: "Menu",
  TAKEAWAY: "Takeaway",
  STAFF: "Staff",
  MARKETING: "Marketing",
  FEEDBACK: "Feedback"
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function AdminConfigQrCodesPage({ token, restaurantId, venueName = "" }: Props) {
  const { pushToast } = useAdminToast();
  const caps = useMenuCapabilities(token, restaurantId);
  const canView = caps.can("menu", "view");
  const canManage = caps.can("menu", "publish");

  const [items, setItems] = useState<QrCodeRow[]>([]);
  const [stats, setStats] = useState<QrDashboardStats | null>(null);
  const [menus, setMenus] = useState<MenuSurfaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [manageQr, setManageQr] = useState<QrCodeRow | null>(null);

  const reload = useCallback(async () => {
    if (!token || !restaurantId) return;
    setLoading(true);
    setError(null);
    const [listRes, statsRes, menusRes] = await Promise.all([
      listQrCodes(token, restaurantId, q.trim() ? { q: q.trim() } : undefined),
      getQrCodeStats(token, restaurantId),
      listRestaurantMenus(token, restaurantId, "PUBLISHED")
    ]);
    setLoading(false);
    if (!listRes.ok) {
      setError(listRes.message ?? listRes.error ?? "Could not load QR codes");
      return;
    }
    setItems(listRes.items ?? []);
    if (statsRes.ok && statsRes.stats) setStats(statsRes.stats);
    if (menusRes.ok) setMenus(menusRes.menus ?? []);
  }, [token, restaurantId, q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
        <AdminSectionHeader eyebrowText="Configuration" title="QR codes" description={CONFIG_PRESET_DESCRIPTIONS["qr-codes"]} />
        <AdminEmptyState>Select a venue to manage QR ordering identities.</AdminEmptyState>
      </AdminPanel>
    );
  }

  if (!canView) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
        <AdminSectionHeader eyebrowText="Configuration" title="QR codes" description={CONFIG_PRESET_DESCRIPTIONS["qr-codes"]} />
        <AdminEmptyState>You need menu view permission to see QR codes.</AdminEmptyState>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="QR codes"
        description={CONFIG_PRESET_DESCRIPTIONS["qr-codes"]}
        action={
          <div className="flex flex-wrap gap-2">
            <AdminRefreshButton onRefresh={() => void reload()} refreshing={loading} />
            {canManage ? (
              <MenuToolbarButton primary onClick={() => setCreateOpen(true)}>
                Create QR
              </MenuToolbarButton>
            ) : null}
          </div>
        }
      />

      <AdminStaleContent refreshing={loading && items.length > 0}>
        {loading && !stats ? (
          <AdminSkeletonStatGrid count={4} />
        ) : stats ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Active" value={String(stats.activeCount)} hint={`${stats.tableCount} table QRs`} />
            <StatTile label="Scans today" value={String(stats.scansToday)} hint={`${stats.totalScans} all-time`} />
            <StatTile label="Orders today" value={String(stats.ordersToday)} hint={`${stats.totalOrders} from QR`} />
            <StatTile
              label="Revenue today"
              value={formatMoneyCents(stats.revenueTodayCents, { currency: "SEK" })}
              hint={venueName || "QR-attributed"}
            />
          </div>
        ) : null}

        <MenuSection
          title="QR identities"
          description="Permanent digital locations. Guests scan → temporary ordering session. Print packs and abuse alerts come later."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <AdminInput
              className="max-w-xs"
              placeholder="Search name, table, code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

          {items.length === 0 && !loading ? (
            <div className="space-y-3">
              <AdminEmptyState>
                No QR codes yet. Create a permanent table or menu QR — the printed link stays valid; each scan starts a fresh session.
              </AdminEmptyState>
              {canManage ? (
                <AdminBtnPrimary type="button" onClick={() => setCreateOpen(true)}>
                  Create first QR
                </AdminBtnPrimary>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-left text-sm">
                <thead className="admin-config-text-muted border-b bg-black/[0.02] text-[10px] font-bold uppercase tracking-[0.12em]">
                  <tr>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5">Destination</th>
                    <th className="px-3 py-2.5">Scans</th>
                    <th className="px-3 py-2.5">Orders</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3">{TYPE_LABEL[row.type]}</td>
                      <td className="px-3 py-3 admin-config-text-subtle">
                        {[row.areaLabel, row.tableLabel || row.locationLabel].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-3 admin-config-text-subtle">
                        {row.menuName ?? (row.experience === "ORDERING" ? "Auto menu" : row.experience.replace("_", " "))}
                      </td>
                      <td className="px-3 py-3">{row.scanCount}</td>
                      <td className="px-3 py-3">{row.orderCount}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            row.status === "ACTIVE"
                              ? "text-emerald-700"
                              : row.status === "INACTIVE"
                                ? "text-amber-700"
                                : "admin-config-text-muted"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          className="admin-btn-secondary text-xs"
                          onClick={() => setManageQr(row)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MenuSection>
      </AdminStaleContent>

      <QrCreateWizardModal
        open={createOpen}
        token={token}
        restaurantId={restaurantId}
        menus={menus}
        onClose={() => setCreateOpen(false)}
        onCreated={(qr) => {
          setCreateOpen(false);
          setManageQr(qr);
          pushToast("QR identity created.", "success");
          void reload();
        }}
      />

      <QrManageModal
        open={Boolean(manageQr)}
        qr={manageQr}
        token={token}
        restaurantId={restaurantId}
        menus={menus}
        canManage={canManage}
        onClose={() => setManageQr(null)}
        onChanged={(qr) => {
          setManageQr(qr);
          void reload();
        }}
        onToast={(msg, tone) => pushToast(msg, tone)}
      />
    </AdminPanel>
  );
}

function QrCreateWizardModal({
  open,
  token,
  restaurantId,
  menus,
  onClose,
  onCreated
}: {
  open: boolean;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  onClose: () => void;
  onCreated: (qr: QrCodeRow) => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<QrCodeType>("TABLE");
  const [name, setName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [experience, setExperience] = useState<QrExperience>("ORDERING");
  const [paymentMode, setPaymentMode] = useState<QrPaymentMode>("PAY_AT_VENUE");
  const [menuId, setMenuId] = useState("");
  const [allowOrdering, setAllowOrdering] = useState(true);
  const [headline, setHeadline] = useState("Scan to order");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setType("TABLE");
    setName("");
    setLocationLabel("");
    setAreaLabel("");
    setTableLabel("");
    setExperience("ORDERING");
    setPaymentMode("PAY_AT_VENUE");
    setMenuId("");
    setAllowOrdering(true);
    setHeadline("Scan to order");
  }, [open]);

  useEffect(() => {
    if (type === "TAKEAWAY") {
      setPaymentMode("PREPAY");
      setExperience("ORDERING");
      setAllowOrdering(true);
    } else if (type === "MENU") {
      setExperience("MENU_BROWSE");
      setAllowOrdering(false);
      setPaymentMode("PAY_AT_VENUE");
    } else if (type === "FEEDBACK") {
      setExperience("FEEDBACK");
      setAllowOrdering(false);
    } else if (type === "MARKETING") {
      setExperience("PROMOTION");
      setAllowOrdering(false);
    } else {
      setExperience("ORDERING");
      setAllowOrdering(true);
      setPaymentMode("PAY_AT_VENUE");
    }
  }, [type]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body: CreateQrCodeBody = {
      name: name.trim() || tableLabel.trim() || TYPE_LABEL[type],
      type,
      experience,
      locationLabel: locationLabel.trim() || null,
      areaLabel: areaLabel.trim() || null,
      tableLabel: tableLabel.trim() || null,
      paymentMode,
      menuId: menuId || null,
      allowOrdering,
      headline: headline.trim() || "Scan to order"
    };
    const res = await createQrCode(token, restaurantId, body);
    setBusy(false);
    if (!res.ok || !res.qr) {
      setError(res.message ?? res.error ?? "Could not create QR");
      return;
    }
    onCreated(res.qr);
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Create QR identity"
      description="Permanent digital location — guests get a fresh session on every scan."
      titleId="qr-create-title"
      stackLevel="overlay"
    >
      <div className="mb-4 flex gap-2 text-xs font-semibold uppercase tracking-wide admin-config-text-muted">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={step === n ? "text-[var(--admin-accent,#0f766e)]" : ""}>
            {n}. {n === 1 ? "Where" : n === 2 ? "Experience" : n === 3 ? "Rules" : "Design"}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Type</span>
            <select
              className="admin-input mt-1 w-full"
              value={type}
              onChange={(e) => setType(e.target.value as QrCodeType)}
            >
              {(Object.keys(TYPE_LABEL) as QrCodeType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Name</span>
            <AdminInput className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Table 12" />
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Location</span>
            <AdminInput className="mt-1" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Main restaurant" />
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Area</span>
            <AdminInput className="mt-1" value={areaLabel} onChange={(e) => setAreaLabel(e.target.value)} placeholder="Indoor" />
          </AdminLabel>
          {type === "TABLE" ? (
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Table label</span>
              <AdminInput className="mt-1" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Table 12" />
            </AdminLabel>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Experience</span>
            <select
              className="admin-input mt-1 w-full"
              value={experience}
              onChange={(e) => setExperience(e.target.value as QrExperience)}
            >
              <option value="ORDERING">Ordering</option>
              <option value="MENU_BROWSE">Menu browsing</option>
              <option value="FEEDBACK">Feedback (soon)</option>
              <option value="PROMOTION">Promotion (soon)</option>
              <option value="RESERVATION">Reservation (soon)</option>
            </select>
          </AdminLabel>
          <p className="text-xs admin-config-text-subtle">
            Ordering and menu browse resolve to a guest session. Feedback / promo / reservation are creatable now and resolve later.
          </p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowOrdering} onChange={(e) => setAllowOrdering(e.target.checked)} />
            Allow ordering
          </label>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Payment</span>
            <select
              className="admin-input mt-1 w-full"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as QrPaymentMode)}
            >
              <option value="PAY_AT_VENUE">Pay at venue</option>
              <option value="PREPAY">Pay online</option>
              <option value="HYBRID">Both</option>
            </select>
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Menu destination</span>
            <select className="admin-input mt-1 w-full" value={menuId} onChange={(e) => setMenuId(e.target.value)}>
              <option value="">Auto (first published)</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </AdminLabel>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Print headline</span>
            <AdminInput className="mt-1" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </AdminLabel>
          <p className="text-xs admin-config-text-subtle">
            After create you can download PNG. SVG/PDF print sheets and logo overlays are next.
          </p>
        </div>
      ) : null}

      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <AdminBtnSecondary type="button" onClick={onClose}>
          Cancel
        </AdminBtnSecondary>
        {step > 1 ? (
          <AdminBtnSecondary type="button" onClick={() => setStep((s) => s - 1)}>
            Back
          </AdminBtnSecondary>
        ) : null}
        {step < 4 ? (
          <AdminBtnPrimary type="button" onClick={() => setStep((s) => s + 1)}>
            Continue
          </AdminBtnPrimary>
        ) : (
          <AdminBtnPrimary type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Creating…" : "Create QR"}
          </AdminBtnPrimary>
        )}
      </div>
    </MenuPageModalShell>
  );
}

function QrManageModal({
  open,
  qr,
  token,
  restaurantId,
  menus,
  canManage,
  onClose,
  onChanged,
  onToast
}: {
  open: boolean;
  qr: QrCodeRow | null;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  canManage: boolean;
  onClose: () => void;
  onChanged: (qr: QrCodeRow) => void;
  onToast: (msg: string, tone: "success" | "error") => void;
}) {
  const [name, setName] = useState("");
  const [paymentMode, setPaymentMode] = useState<QrPaymentMode>("PAY_AT_VENUE");
  const [menuId, setMenuId] = useState("");
  const [allowOrdering, setAllowOrdering] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qr) return;
    setName(qr.name);
    setPaymentMode(qr.paymentMode);
    setMenuId(qr.menuId ?? "");
    setAllowOrdering(qr.allowOrdering);
    setError(null);
  }, [qr]);

  const run = async (fn: () => Promise<{ ok: boolean; qr?: QrCodeRow; message?: string; error?: string }>, okMsg: string) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok || !res.qr) {
      setError(res.message ?? res.error ?? "Action failed");
      onToast(res.message ?? "Action failed", "error");
      return;
    }
    onChanged(res.qr);
    onToast(okMsg, "success");
  };

  if (!qr) return null;

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={qr.name}
      description={`${TYPE_LABEL[qr.type]} · /q/${qr.publicCode}`}
      titleId="qr-manage-title"
      stackLevel="overlay"
    >
      <div className="admin-menu-qr-preview mb-4 rounded-xl border p-4 text-center">
        <img src={qr.qrImageUrl} alt="" className="mx-auto h-44 w-44 rounded-lg border bg-white p-2" />
        <p className="admin-config-text-subtle mt-3 break-all text-xs">{qr.publicUrl}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a className="admin-btn-secondary inline-flex" href={qr.pngDownloadUrl} download={`${qr.name}-qr.png`} target="_blank" rel="noreferrer">
            Download PNG
          </a>
          <button type="button" className="admin-btn-secondary" onClick={() => void navigator.clipboard.writeText(qr.publicUrl)}>
            Copy link
          </button>
        </div>
      </div>

      {canManage ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Name</span>
            <AdminInput className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </AdminLabel>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowOrdering} onChange={(e) => setAllowOrdering(e.target.checked)} />
            Allow ordering
          </label>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Payment</span>
            <select className="admin-input mt-1 w-full" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as QrPaymentMode)}>
              <option value="PAY_AT_VENUE">Pay at venue</option>
              <option value="PREPAY">Pay online</option>
              <option value="HYBRID">Both</option>
            </select>
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Menu</span>
            <select className="admin-input mt-1 w-full" value={menuId} onChange={(e) => setMenuId(e.target.value)}>
              <option value="">Auto (first published)</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </AdminLabel>
        </div>
      ) : null}

      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canManage ? (
          <>
            <button
              type="button"
              className="admin-btn-secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    updateQrCode(token, restaurantId, qr.id, {
                      name,
                      paymentMode,
                      menuId: menuId || null,
                      allowOrdering
                    }),
                  "QR updated."
                )
              }
            >
              Save changes
            </button>
            {qr.status === "ACTIVE" ? (
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={busy}
                onClick={() => void run(() => deactivateQrCode(token, restaurantId, qr.id), "QR deactivated.")}
              >
                Deactivate
              </button>
            ) : qr.status === "INACTIVE" ? (
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={busy}
                onClick={() => void run(() => reactivateQrCode(token, restaurantId, qr.id), "QR reactivated.")}
              >
                Reactivate
              </button>
            ) : null}
            <button
              type="button"
              className="admin-btn-secondary"
              disabled={busy}
              onClick={() => void run(() => rotateQrCode(token, restaurantId, qr.id), "QR rotated — reprint the new code.")}
            >
              Rotate
            </button>
            <button
              type="button"
              className="admin-btn-secondary"
              disabled={busy}
              onClick={() => void run(() => duplicateQrCode(token, restaurantId, qr.id), "QR duplicated.")}
            >
              Duplicate
            </button>
          </>
        ) : null}
      </div>

      <ProfileModalFooter onCancel={onClose} confirmLabel="Close" onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
