import { useEffect, useMemo, useState } from "react";
import {
  createDataTransferTemplate,
  updateDataTransferTemplate,
  type DataTransferTemplateRow,
  type DataTransferTemplateStatus,
  type ImportExportCatalog
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { AdminInput, AdminLabel, inputBase } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import {
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote
} from "../menu/menuPageModalShell";
import { MENU_CSV_TEMPLATE } from "./transferUiHelpers";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  token: string;
  restaurantId: string;
  catalog: ImportExportCatalog | null;
  template: DataTransferTemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  name: string;
  description: string;
  targetKey: string;
  status: DataTransferTemplateStatus;
  content: string;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active", hint: "Ready to download and use in import" },
  { value: "DRAFT", label: "Draft", hint: "Still being prepared" },
  { value: "ARCHIVED", label: "Archived", hint: "Keep for reference" }
];

function defaultContentForTarget(targetKey: string) {
  if (targetKey === "menu") return MENU_CSV_TEMPLATE;
  if (targetKey === "customers") return "external_id,full_name,email,phone,notes\n";
  if (targetKey === "staff") return "external_id,full_name,email,role,active\n";
  if (targetKey === "inventory") return "sku,name,quantity,unit,notes\n";
  return "column_a,column_b,column_c\n";
}

export function TransferTemplateFormModal({
  open,
  mode,
  token,
  restaurantId,
  catalog,
  template,
  onClose,
  onSaved
}: Props) {
  const { pushToast } = useAdminToast();
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    targetKey: "menu",
    status: "ACTIVE",
    content: MENU_CSV_TEMPLATE
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = useMemo(() => {
    const targets = catalog?.targets ?? [];
    return targets
      .filter((t) => t.directions.includes("import"))
      .map((t) => ({
        value: t.key,
        label: t.label,
        hint: t.availability === "planned" ? "Planned target — template can be prepared now" : t.description
      }));
  }, [catalog]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && template) {
      setForm({
        name: template.name,
        description: template.description ?? "",
        targetKey: template.targetKey,
        status: template.status,
        content: template.content
      });
      return;
    }
    setForm({
      name: "",
      description: "",
      targetKey: "menu",
      status: "ACTIVE",
      content: MENU_CSV_TEMPLATE
    });
  }, [open, mode, template]);

  const title = mode === "edit" ? "Edit template" : "Create template";
  const description =
    mode === "edit"
      ? "Update name, status, or CSV content. Version bumps when content or data type changes."
      : "Create a venue template the team can download and reuse in imports.";

  const submit = async () => {
    const name = form.name.trim();
    if (name.length < 2) {
      setError("Enter a template name with at least 2 characters.");
      return;
    }
    if (!form.content.trim()) {
      setError("Template content cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    if (mode === "edit" && template) {
      const res = await updateDataTransferTemplate(token, restaurantId, template.id, {
        name,
        description: form.description.trim() || null,
        targetKey: form.targetKey,
        content: form.content,
        status: form.status,
        format: "csv"
      });
      setBusy(false);
      if (!res.ok || !res.template) {
        setError(res.message ?? res.error ?? "Could not update template");
        return;
      }
      pushToast("Template updated.", "success");
      onSaved();
      onClose();
      return;
    }

    const res = await createDataTransferTemplate(token, restaurantId, {
      name,
      description: form.description.trim() || null,
      targetKey: form.targetKey,
      content: form.content,
      status: form.status,
      format: "csv"
    });
    setBusy(false);
    if (!res.ok || !res.template) {
      setError(res.message ?? res.error ?? "Could not create template");
      return;
    }
    pushToast("Template created.", "success");
    onSaved();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      titleId="data-transfer-template-form"
      maxWidthClass="max-w-2xl"
      busy={busy}
    >
      <div className="grid gap-4">
        {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

        <div>
          <AdminLabel>Name</AdminLabel>
          <AdminInput
            className="mt-1"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Dinner menu import sheet"
            maxLength={120}
          />
        </div>

        <div>
          <AdminLabel>Description</AdminLabel>
          <AdminInput
            className="mt-1"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What this template is for"
            maxLength={500}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminBubbleDropdown
            label="Data type"
            value={form.targetKey}
            options={targetOptions.length ? targetOptions : [{ value: "menu", label: "Menu" }]}
            onChange={(value) =>
              setForm((f) => ({
                ...f,
                targetKey: value,
                content:
                  mode === "create" && f.content === defaultContentForTarget(f.targetKey)
                    ? defaultContentForTarget(value)
                    : f.content
              }))
            }
          />
          <AdminBubbleDropdown
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(value) => setForm((f) => ({ ...f, status: value as DataTransferTemplateStatus }))}
          />
        </div>

        <div>
          <AdminLabel>CSV content</AdminLabel>
          <textarea
            className={`${inputBase} mt-1 min-h-[220px] font-mono text-xs leading-relaxed`}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            spellCheck={false}
            aria-label="Template CSV content"
          />
          <div className="mt-2">
            <ProfileModalNote>
              Headers on the first row. Sample data rows help your team fill imports correctly.
            </ProfileModalNote>
          </div>
        </div>
      </div>

      <ProfileModalFooter
        confirmLabel={mode === "edit" ? "Save changes" : "Create template"}
        cancelLabel="Cancel"
        onConfirm={() => void submit()}
        onCancel={onClose}
        confirmDisabled={busy}
        busy={busy}
      />
    </MenuPageModalShell>
  );
}
