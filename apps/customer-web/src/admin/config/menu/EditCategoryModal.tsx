import { useEffect, useMemo, useState } from "react";
import { updateCategory, type MenuSurfaceRow } from "../../../api";
import { AdminInput, AdminLabel, inputBase } from "../../AdminUi";
import {
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter
} from "./menuPageModalShell";
import type { CategoryListRow } from "./categoryListHelpers";

type Props = {
  open: boolean;
  category: CategoryListRow | null;
  menus: MenuSurfaceRow[];
  token: string;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function EditCategoryModal({
  open,
  category,
  menus,
  token,
  restaurantId,
  onClose,
  onSaved
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [menuId, setMenuId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);

  useEffect(() => {
    if (!open || !category) return;
    setName(category.name);
    setDescription(category.description ?? "");
    setMenuId(category.menuId ?? activeMenus[0]?.id ?? "");
    setError(null);
  }, [open, category, activeMenus]);

  const save = async () => {
    if (!category) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Category name needs at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await updateCategory(token, restaurantId, category.id, {
      name: trimmed,
      description: description.trim() || null,
      menuId: menuId || null
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not update category.");
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Edit category"
      description="Update this category’s name, description, and parent menu."
      titleId="edit-category-title"
      stackLevel="overlay"
    >
      <AdminLabel>
        <span className="text-xs admin-config-text-muted">Name</span>
        <AdminInput className="mt-1" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </AdminLabel>
      <AdminLabel className="mt-3 block">
        <span className="text-xs admin-config-text-muted">Description</span>
        <textarea
          className={`${inputBase} admin-staff-premium-input admin-staff-premium-textarea mt-1`}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </AdminLabel>
      <AdminLabel className="mt-3 block">
        <span className="text-xs admin-config-text-muted">Menu</span>
        <select className={`${inputBase} mt-1 w-full`} value={menuId} onChange={(e) => setMenuId(e.target.value)} disabled={busy}>
          {activeMenus.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </AdminLabel>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void save()}
        confirmLabel={busy ? "Saving…" : "Save"}
        busy={busy}
        confirmDisabled={!category || name.trim().length < 2}
      />
    </MenuPageModalShell>
  );
}
