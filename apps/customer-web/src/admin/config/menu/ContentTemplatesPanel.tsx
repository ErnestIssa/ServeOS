import { useEffect, useState } from "react";
import {
  applyContentTemplate,
  getReplicationJob,
  listContentTemplates,
  saveMenuAsTemplate,
  type ContentTemplateRow,
  type MenuSurfaceRow
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import {
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote
} from "./menuPageModalShell";

type Props = {
  open: boolean;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  locationDestinations: Array<{ id: string; label: string; hint?: string }>;
  canCreate: boolean;
  onClose: () => void;
  onApplied: () => void;
};

export function ContentTemplatesPanel({
  open,
  token,
  restaurantId,
  menus,
  locationDestinations,
  canCreate,
  onClose,
  onApplied
}: Props) {
  const { pushToast } = useAdminToast();
  const [templates, setTemplates] = useState<ContentTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMenuId, setSaveMenuId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [applyId, setApplyId] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState(restaurantId);
  const [applyBusy, setApplyBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await listContentTemplates(token, restaurantId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Could not load templates.");
      return;
    }
    setTemplates(res.templates ?? []);
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    setSaveMenuId(menus[0]?.id ?? "");
    setSaveName("");
    setApplyId(null);
    setApplyTarget(restaurantId);
    void refresh();
  }, [open, token, restaurantId, menus]);

  const save = async () => {
    if (!saveMenuId || !canCreate) return;
    setSaveBusy(true);
    const res = await saveMenuAsTemplate(token, restaurantId, saveMenuId, {
      name: saveName.trim() || undefined
    });
    setSaveBusy(false);
    if (!res.ok || !res.template) {
      pushToast(res.message ?? res.error ?? "Could not save template.", "error");
      return;
    }
    pushToast(`Template “${res.template.name}” saved.`, "success");
    setSaveName("");
    void refresh();
  };

  const apply = async (templateId: string) => {
    if (!canCreate) return;
    setApplyBusy(true);
    setApplyId(templateId);
    const res = await applyContentTemplate(token, restaurantId, templateId, {
      targetRestaurantId: applyTarget || restaurantId
    });
    if (!res.ok || !res.jobId) {
      setApplyBusy(false);
      setApplyId(null);
      pushToast(res.message ?? res.error ?? "Could not apply template.", "error");
      return;
    }

    const poll = async () => {
      for (let i = 0; i < 90; i += 1) {
        await new Promise((r) => window.setTimeout(r, 1200));
        const job = await getReplicationJob(token, restaurantId, res.jobId!);
        if (!job.ok || !job.job) continue;
        if (job.job.status === "COMPLETED") {
          setApplyBusy(false);
          setApplyId(null);
          pushToast(
            `“${job.job.result?.name ?? "Menu"}” created from template.`,
            "success"
          );
          onApplied();
          onClose();
          return;
        }
        if (job.job.status === "FAILED" || job.job.status === "CANCELLED") {
          setApplyBusy(false);
          setApplyId(null);
          pushToast(job.job.error ?? "Template apply failed.", "error");
          return;
        }
      }
      setApplyBusy(false);
      setApplyId(null);
      pushToast("Template apply is still running in the background.", "success");
      onApplied();
    };
    void poll();
  };

  const locationOptions = [
    { value: restaurantId, label: "This location" },
    ...locationDestinations.map((d) => ({ value: d.id, label: d.label }))
  ];

  return (
    <MenuPageModalShell
      open={open}
      onClose={applyBusy ? () => undefined : onClose}
      title="Menu templates"
      description="Save a menu as a reusable template, then apply it as a draft at this or another location."
      titleId="content-templates-title"
      stackLevel="overlay"
      maxWidthClass="max-w-4xl"
      maxHeightClass="max-h-[min(92dvh,40rem)]"
      bodyScroll={false}
      bodyClassName="admin-content-templates-body"
      panelClassName="admin-content-templates-panel"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      <div className="admin-content-templates-layout">
        {canCreate && menus.length > 0 ? (
          <section className="admin-content-templates-card">
            <header className="admin-content-templates-card-head">
              <h3>Save as template</h3>
              <p>Pick a source menu and optionally rename the template.</p>
            </header>
            <div className="admin-content-templates-fields">
              <AdminBubbleDropdown
                label="Source menu"
                value={saveMenuId}
                options={menus.map((m) => ({ value: m.id, label: m.name }))}
                onChange={setSaveMenuId}
                disabled={saveBusy}
                containWithinModal
                dropInline
              />
              <AdminLabel>
                Template name (optional)
                <AdminInput
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  disabled={saveBusy}
                  placeholder="e.g. Weekend brunch starter"
                />
              </AdminLabel>
              <button
                type="button"
                className="admin-menu-manage-action admin-content-templates-save-btn"
                disabled={saveBusy || !saveMenuId}
                onClick={() => void save()}
              >
                <span className="admin-menu-manage-action-label">
                  {saveBusy ? "Saving…" : "Save template"}
                </span>
              </button>
            </div>
          </section>
        ) : null}

        <section className="admin-content-templates-card">
          <header className="admin-content-templates-card-head">
            <h3>Apply template</h3>
            <p>Choose where new draft menus from a template should land.</p>
          </header>
          <div className="admin-content-templates-fields">
            {canCreate ? (
              <AdminBubbleDropdown
                label="Apply destination"
                value={applyTarget}
                options={locationOptions}
                onChange={setApplyTarget}
                disabled={applyBusy}
                containWithinModal
                dropInline
              />
            ) : (
              <ProfileModalNote>You can view templates, but creating from them needs create access.</ProfileModalNote>
            )}

            {loading ? (
              <ProfileModalNote>Loading templates…</ProfileModalNote>
            ) : templates.length === 0 ? (
              <ProfileModalNote>No templates yet. Save a menu to create one.</ProfileModalNote>
            ) : (
              <ul className="admin-content-templates-list">
                {templates.map((t) => (
                  <li key={t.id} className="admin-content-templates-row">
                    <div className="min-w-0">
                      <p className="admin-content-templates-row-name">{t.name}</p>
                      <p className="admin-content-templates-row-meta">
                        Updated {new Date(t.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {canCreate ? (
                      <button
                        type="button"
                        className="admin-content-templates-apply-btn"
                        disabled={applyBusy}
                        onClick={() => void apply(t.id)}
                      >
                        {applyBusy && applyId === t.id ? "Applying…" : "Apply"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <ProfileModalFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Close" busy={applyBusy} />
    </MenuPageModalShell>
  );
}
