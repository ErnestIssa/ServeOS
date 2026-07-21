import { useEffect, useState } from "react";
import {
  compareMenuVersionsApi,
  getMenuReleasePreview,
  listMenuVersions,
  publishRestaurantMenu,
  rollbackMenuVersionApi,
  type MenuReleasePreview,
  type MenuSurfaceRow,
  type MenuVersionCompareResult,
  type MenuVersionListItem
} from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { ProfileModalAlert, ProfileModalFooter, MenuPageModalShell } from "./menuPageModalShell";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function changeHeadline(preview: MenuReleasePreview) {
  const s = preview.changeSummary;
  const bits: string[] = [];
  if (s.categoriesAdded) bits.push(`${s.categoriesAdded} new categor${s.categoriesAdded === 1 ? "y" : "ies"}`);
  if (s.itemsAdded) bits.push(`${s.itemsAdded} new item${s.itemsAdded === 1 ? "" : "s"}`);
  if (s.pricesChanged) bits.push(`${s.pricesChanged} price update${s.pricesChanged === 1 ? "" : "s"}`);
  if (s.itemsHidden) bits.push(`${s.itemsHidden} hidden item${s.itemsHidden === 1 ? "" : "s"}`);
  if (s.itemsShown) bits.push(`${s.itemsShown} shown item${s.itemsShown === 1 ? "" : "s"}`);
  if (s.mediaChanged) bits.push(`${s.mediaChanged} media update${s.mediaChanged === 1 ? "" : "s"}`);
  if (s.modifiersChanged) bits.push(`${s.modifiersChanged} modifier update${s.modifiersChanged === 1 ? "" : "s"}`);
  if (s.itemsUpdated && bits.length === 0) bits.push(`${s.itemsUpdated} updated item${s.itemsUpdated === 1 ? "" : "s"}`);
  if (s.categoriesRemoved) bits.push(`${s.categoriesRemoved} removed categor${s.categoriesRemoved === 1 ? "y" : "ies"}`);
  if (s.itemsRemoved) bits.push(`${s.itemsRemoved} removed item${s.itemsRemoved === 1 ? "" : "s"}`);
  return bits.length ? bits : ["No structural changes detected"];
}

type PublishProps = {
  open: boolean;
  menu: MenuSurfaceRow | null;
  token: string;
  restaurantId: string;
  onClose: () => void;
  onPublished: (summary: { versionNumber: number; menuName: string }) => void;
};

export function MenuPublishReviewModal({
  open,
  menu,
  token,
  restaurantId,
  onClose,
  onPublished
}: PublishProps) {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MenuReleasePreview | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !menu) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotes("");
    void getMenuReleasePreview(token, restaurantId, menu.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.preview) {
        setError(res.message ?? res.error ?? "Could not load release preview.");
        setPreview(null);
        return;
      }
      setPreview(res.preview);
    });
    return () => {
      cancelled = true;
    };
  }, [open, menu?.id, token, restaurantId]);

  const publish = async () => {
    if (!menu || !preview) return;
    if (!preview.validation.ok) {
      setError("Fix validation issues before publishing.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await publishRestaurantMenu(token, restaurantId, menu.id, {
      releaseNotes: notes.trim() || null,
      requireChanges: preview.status === "PUBLISHED"
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not publish menu.");
      if (res.validation) {
        setPreview((prev) => (prev ? { ...prev, validation: res.validation! } : prev));
      }
      return;
    }
    onPublished({
      versionNumber: res.menu?.versionNumber ?? preview.nextVersionNumber,
      menuName: menu.name
    });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy || loading ? () => undefined : onClose}
      title="Ready to publish?"
      description={
        preview
          ? `Version ${preview.nextVersionNumber} — guests will immediately see these changes.`
          : `Review draft changes for “${menu?.name ?? "this menu"}” before releasing.`
      }
      titleId="menu-publish-review-title"
      stackLevel="overlay"
    >
      {loading ? <p className="admin-config-text-muted text-sm">Checking draft workspace…</p> : null}
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      {preview ? (
        <div className="admin-menu-release-review">
          <div className="admin-menu-release-review-block">
            <h4 className="admin-staff-drawer-section-title">Changes</h4>
            <ul className="admin-menu-release-change-list">
              {changeHeadline(preview).map((line) => (
                <li key={line}>✓ {line}</li>
              ))}
            </ul>
            {preview.changeSummary.lines.length > 0 ? (
              <details className="admin-menu-release-details">
                <summary>
                  {preview.changeSummary.totalChanges} change
                  {preview.changeSummary.totalChanges === 1 ? "" : "s"} detail
                </summary>
                <ul className="admin-menu-release-change-list admin-menu-release-change-list--detail">
                  {preview.changeSummary.lines.slice(0, 40).map((line, i) => (
                    <li key={`${line.kind}-${i}`}>
                      {line.label}
                      {line.detail ? <span className="admin-config-text-muted"> — {line.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div className="admin-menu-release-review-block">
            <h4 className="admin-staff-drawer-section-title">Validation</h4>
            <ul className="admin-menu-release-change-list">
              {preview.validation.checks.map((c) => (
                <li key={c.id} className={c.ok ? undefined : "is-fail"}>
                  {c.ok ? "✓" : "✕"} {c.label}
                  {c.detail ? <span className="admin-config-text-muted"> — {c.detail}</span> : null}
                </li>
              ))}
            </ul>
          </div>

          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Release notes (optional)</span>
            <AdminInput
              className="mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What changed in this release?"
              maxLength={500}
            />
          </AdminLabel>
        </div>
      ) : null}

      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void publish()}
        confirmLabel={busy ? "Publishing…" : "Publish"}
        busy={busy || loading}
        confirmDisabled={!preview || !preview.validation.ok}
      />
    </MenuPageModalShell>
  );
}

type HistoryProps = {
  open: boolean;
  menu: MenuSurfaceRow | null;
  token: string;
  restaurantId: string;
  canRollback: boolean;
  onClose: () => void;
  onRolledBack: (versionNumber: number) => void;
};

export function MenuVersionHistoryDrawer({
  open,
  menu,
  token,
  restaurantId,
  canRollback,
  onClose,
  onRolledBack
}: HistoryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<MenuVersionListItem[]>([]);
  const [compare, setCompare] = useState<MenuVersionCompareResult | null>(null);
  const [busyVersion, setBusyVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !menu) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCompare(null);
    void listMenuVersions(token, restaurantId, menu.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.versions) {
        setError(res.message ?? res.error ?? "Could not load versions.");
        setVersions([]);
        return;
      }
      setVersions(res.versions);
    });
    return () => {
      cancelled = true;
    };
  }, [open, menu?.id, token, restaurantId]);

  const runCompare = async (from: number, to: number) => {
    if (!menu) return;
    setError(null);
    const res = await compareMenuVersionsApi(token, restaurantId, menu.id, from, to);
    if (!res.ok || !res.compare) {
      setError(res.message ?? res.error ?? "Could not compare versions.");
      return;
    }
    setCompare(res.compare);
  };

  const runRollback = async (versionNumber: number) => {
    if (!menu) return;
    setBusyVersion(versionNumber);
    setError(null);
    const res = await rollbackMenuVersionApi(token, restaurantId, menu.id, versionNumber);
    setBusyVersion(null);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not roll back.");
      return;
    }
    onRolledBack(res.menu?.versionNumber ?? versionNumber);
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busyVersion != null ? () => undefined : onClose}
      title="Version history"
      description={
        menu
          ? `Published releases for “${menu.name}”. Rollback creates a new live version from a past snapshot.`
          : "Published releases for this menu."
      }
      titleId="menu-version-history-title"
      stackLevel="overlay"
      maxWidthClass="max-w-2xl"
    >
      {loading ? <p className="admin-config-text-muted text-sm">Loading versions…</p> : null}
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      {!loading && versions.length === 0 ? (
        <p className="admin-config-text-muted text-sm">No published versions yet.</p>
      ) : (
        <ul className="admin-menu-version-list">
          {versions.map((v, index) => {
            const newer = versions[index - 1];
            return (
              <li key={v.id} className={`admin-menu-version-row${v.isActive ? " is-active" : ""}`}>
                <div className="admin-menu-version-main">
                  <strong>Version {v.versionNumber}</strong>
                  {v.isActive ? <span className="admin-menu-surface-status admin-menu-surface-status--live">Live</span> : null}
                  <span className="admin-config-text-muted text-sm">{formatWhen(v.publishedAt)}</span>
                  <span className="admin-config-text-muted text-sm">
                    {v.categoryCount} categories · {v.itemCount} items
                  </span>
                  {v.releaseNotes ? <p className="admin-menu-version-notes">{v.releaseNotes}</p> : null}
                </div>
                <div className="admin-menu-version-actions">
                  {newer ? (
                    <AdminBtnSecondary
                      type="button"
                      onClick={() => void runCompare(v.versionNumber, newer.versionNumber)}
                    >
                      Compare → v{newer.versionNumber}
                    </AdminBtnSecondary>
                  ) : null}
                  {canRollback && !v.isActive ? (
                    <AdminBtnSecondary
                      type="button"
                      disabled={busyVersion != null}
                      onClick={() => void runRollback(v.versionNumber)}
                    >
                      {busyVersion === v.versionNumber ? "Rolling back…" : "Rollback"}
                    </AdminBtnSecondary>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {compare ? (
        <div className="admin-menu-release-review-block mt-4">
          <h4 className="admin-staff-drawer-section-title">
            Compare v{compare.fromVersionNumber} → v{compare.toVersionNumber}
          </h4>
          {compare.priceChanges.length ? (
            <ul className="admin-menu-release-change-list">
              {compare.priceChanges.map((p) => (
                <li key={p.itemId}>
                  Price · {p.name}: {(p.fromCents / 100).toFixed(2)} → {(p.toCents / 100).toFixed(2)}
                </li>
              ))}
            </ul>
          ) : null}
          {compare.addedItems.length ? (
            <ul className="admin-menu-release-change-list">
              {compare.addedItems.map((i) => (
                <li key={i.id}>Added · {i.name}</li>
              ))}
            </ul>
          ) : null}
          {compare.removedItems.length ? (
            <ul className="admin-menu-release-change-list">
              {compare.removedItems.map((i) => (
                <li key={i.id}>Removed · {i.name}</li>
              ))}
            </ul>
          ) : null}
          {!compare.priceChanges.length && !compare.addedItems.length && !compare.removedItems.length ? (
            <p className="admin-config-text-muted text-sm">No item-level add/remove/price differences.</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className="admin-profile-modal-btn admin-profile-modal-btn--ghost">
          Close
        </button>
      </div>
    </MenuPageModalShell>
  );
}
