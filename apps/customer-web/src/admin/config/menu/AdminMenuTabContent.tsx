import { useEffect, useMemo, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  createCategory,
  createMenuItem,
  createModifierGroup,
  createModifierOption,
  exportMenuCsv,
  importMenuCsv,
  listRestaurantMenus,
  scheduleRestaurantMenu
} from "../../../api";
import {
  AdminBtnPrimary,
  AdminEmptyState,
  AdminInput,
  AdminLabel,
  AdminSelect
} from "../../AdminUi";
import { AdminSkeletonTable } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import type { MenuCapabilitiesPayload } from "../../../api";
import { MenuItemMediaGallery } from "./MenuItemMediaGallery";
import {
  MenuActionRow,
  MenuChip,
  MenuFieldGroup,
  MenuPreviewFrame,
  MenuReadonlyField,
  MenuSection,
  MenuToolbarButton
} from "./MenuPageUi";

type MenuApi = ReturnType<typeof useAdminMenu>;

type Props = {
  tab: MenuSectionTab;
  api: MenuApi;
  token: string;
  restaurantId: string;
  venueName: string;
  initialLoading: boolean;
  capabilities: MenuCapabilitiesPayload | null;
  can: (entity: keyof MenuCapabilitiesPayload["entities"], action: string) => boolean;
};

const AVAILABILITY_SLOTS = [
  { key: "breakfast", label: "Breakfast", start: "07:00", end: "11:00" },
  { key: "lunch", label: "Lunch", start: "11:00", end: "15:00" },
  { key: "dinner", label: "Dinner", start: "17:00", end: "22:00" },
  { key: "weekend", label: "Weekend", start: "10:00", end: "23:00" },
  { key: "holiday", label: "Holiday", start: "10:00", end: "20:00" }
] as const;

export function AdminMenuTabContent({
  tab,
  api,
  token,
  restaurantId,
  venueName,
  initialLoading,
  capabilities,
  can
}: Props) {
  const { pushToast } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("12.00");
  const [newModItemId, setNewModItemId] = useState("");
  const [newModGroupName, setNewModGroupName] = useState("Choose Size");
  const [newModOptionName, setNewModOptionName] = useState("");
  const [newModGroupId, setNewModGroupId] = useState("");
  const [newModOptionDelta, setNewModOptionDelta] = useState("1.50");

  const categories = api.menu?.categories ?? [];

  useEffect(() => {
    if (!newItemCategoryId && categories[0]) setNewItemCategoryId(categories[0].id);
    if (!newModItemId && api.flatItems[0]) setNewModItemId(api.flatItems[0].id);
  }, [categories, api.flatItems, newItemCategoryId, newModItemId]);

  const modifierGroups = useMemo(() => {
    const out: Array<{ id: string; label: string; itemId: string }> = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        for (const g of item.modifierGroups) {
          out.push({ id: g.id, label: `${item.name} → ${g.name}`, itemId: item.id });
        }
      }
    }
    return out;
  }, [categories]);

  useEffect(() => {
    if (!newModGroupId && modifierGroups[0]) setNewModGroupId(modifierGroups[0].id);
  }, [modifierGroups, newModGroupId]);

  const selectedItem = useMemo(
    () => api.flatItems.find((i) => i.id === selectedItemId) ?? null,
    [api.flatItems, selectedItemId]
  );

  const runCreate = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      pushToast(res.error ?? "Action failed", "error");
      return;
    }
    pushToast(success, "success");
    api.refresh();
  };

  if (initialLoading) {
    const rows = tab === "items" ? 8 : tab === "categories" ? 6 : 4;
    const cols = tab === "items" ? 5 : 4;
    return <AdminSkeletonTable rows={rows} columns={cols} />;
  }

  if (tab === "categories") {
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Categories" description="Group items — Pizza, Burgers, Drinks, Desserts, and more.">
          <div className="admin-menu-form-row">
            <AdminLabel className="flex-1">
              <span className="text-xs admin-config-text-muted">Name</span>
              <AdminInput
                className="mt-1"
                placeholder="e.g. Pizza, Burgers, Drinks, Desserts"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </AdminLabel>
            <AdminBtnPrimary
              disabled={busy || !newCategoryName.trim() || !can("category", "create")}
              onClick={() =>
                void runCreate(
                  () => createCategory(token, restaurantId, { name: newCategoryName.trim() }),
                  `Category "${newCategoryName.trim()}" added.`
                ).then(() => setNewCategoryName(""))
              }
            >
              Create category
            </AdminBtnPrimary>
          </div>
        </MenuSection>

        <MenuSection title="All categories" description="Sort order, visibility, image, and description per category.">
          {categories.length === 0 ? (
            <AdminEmptyState>No categories yet — add Burgers, Pizza, Drinks, or Desserts to get started.</AdminEmptyState>
          ) : (
            <table className="admin-config-data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Sort order</th>
                  <th>Hidden</th>
                  <th>Image</th>
                  <th>Description</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold admin-config-text">{c.name}</td>
                    <td className="admin-config-text-subtle">{c.sortOrder}</td>
                    <td>
                      <MenuChip tone={c.isActive ? "success" : "muted"}>{c.isActive ? "Visible" : "Hidden"}</MenuChip>
                    </td>
                    <td className="admin-config-text-subtle">—</td>
                    <td className="admin-config-text-subtle">—</td>
                    <td className="admin-config-text-muted">{c.items.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MenuSection>
      </div>
    );
  }

  if (tab === "items") {
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Add item" description="Create a new product and assign it to a category.">
          <div className="admin-menu-form-grid">
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Category</span>
              <AdminSelect className="mt-1" value={newItemCategoryId} onChange={(e) => setNewItemCategoryId(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Name</span>
              <AdminInput className="mt-1" placeholder="e.g. Cheeseburger" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Base price</span>
              <AdminInput className="mt-1" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} />
            </AdminLabel>
            <div className="flex items-end">
              <AdminBtnPrimary
                className="w-full sm:w-auto"
                disabled={busy || !newItemName.trim() || !newItemCategoryId || !can("item", "create")}
                onClick={() => {
                  const dollars = Number(newItemPrice);
                  if (!Number.isFinite(dollars)) return pushToast("Invalid price", "error");
                  void runCreate(
                    () =>
                      createMenuItem(token, restaurantId, {
                        categoryId: newItemCategoryId,
                        name: newItemName.trim(),
                        priceCents: Math.round(dollars * 100)
                      }),
                    `Item "${newItemName.trim()}" added.`
                  ).then(() => setNewItemName(""));
                }}
              >
                Create item
              </AdminBtnPrimary>
            </div>
          </div>
        </MenuSection>

        <MenuSection title="Items" description="Select a row to inspect full item fields — basic, pricing, visibility, kitchen, nutrition, and ordering.">
          {api.flatItems.length === 0 ? (
            <AdminEmptyState>No items yet — add products to populate your menu.</AdminEmptyState>
          ) : (
            <table className="admin-config-data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Base price</th>
                  <th>Modifiers</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {api.flatItems.map((item) => (
                  <tr
                    key={item.id}
                    className={selectedItemId === item.id ? "admin-config-row--active" : ""}
                    onClick={() => setSelectedItemId(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedItemId(item.id);
                      }
                    }}
                  >
                    <td className="font-semibold admin-config-text">{item.name}</td>
                    <td className="admin-config-text-muted">{item.categoryName}</td>
                    <td>{formatMoneyCents(item.priceCents)}</td>
                    <td className="admin-config-text-subtle">{item.modifierCount}</td>
                    <td>
                      <MenuChip tone={item.isActive ? "success" : "muted"}>{item.isActive ? "Available" : "Hidden"}</MenuChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MenuSection>

        {selectedItem ? (
          <MenuSection title={selectedItem.name} description="Full item configuration — extended fields save when backend support ships.">
            <div className="admin-menu-field-grid">
              <MenuFieldGroup title="Basic">
                <MenuReadonlyField label="Name" value={selectedItem.name} />
                <MenuReadonlyField label="Description" value={selectedItem.description ?? "—"} />
                <MenuReadonlyField
                  label="Image"
                  value={
                    selectedItem && can("media", "view")
                      ? "See photos & videos below"
                      : can("media", "view")
                        ? "Not uploaded"
                        : "Hidden by role"
                  }
                />
                <MenuReadonlyField label="Category" value={selectedItem.categoryName} />
              </MenuFieldGroup>
              <MenuFieldGroup title="Pricing">
                <MenuReadonlyField label="Base price" value={formatMoneyCents(selectedItem.priceCents)} />
                <MenuReadonlyField label="VAT class" value="Standard" />
                <MenuReadonlyField label="Tax group" value="Food" />
              </MenuFieldGroup>
              <MenuFieldGroup title="Visibility">
                <MenuReadonlyField label="Hidden" value={selectedItem.isActive ? "No" : "Yes"} />
                <MenuReadonlyField label="Available" value={selectedItem.isActive ? "Yes" : "No"} />
                <MenuReadonlyField label="Featured" value="No" />
              </MenuFieldGroup>
              <MenuFieldGroup title="Kitchen">
                <MenuReadonlyField label="Kitchen station" value="—" />
                <MenuReadonlyField label="Prep time" value="—" />
              </MenuFieldGroup>
              <MenuFieldGroup title="Nutrition">
                <MenuReadonlyField label="Allergens" value="—" />
                <MenuReadonlyField label="Calories" value="—" />
                <MenuReadonlyField label="Dietary labels" value="—" />
              </MenuFieldGroup>
              <MenuFieldGroup title="Ordering">
                <MenuReadonlyField label="Requires modifiers" value={selectedItem.modifierCount > 0 ? "Yes" : "No"} />
                <MenuReadonlyField label="Min quantity" value="1" />
                <MenuReadonlyField label="Max quantity" value="—" />
              </MenuFieldGroup>
            </div>
            {can("media", "view") ? (
              <MenuItemMediaGallery
                token={token}
                restaurantId={restaurantId}
                menuItemId={selectedItem.id}
                itemName={selectedItem.name}
                canUpload={can("media", "upload")}
                canRemove={can("media", "remove")}
                limits={capabilities?.limits ?? null}
              />
            ) : null}
          </MenuSection>
        ) : null}
      </div>
    );
  }

  if (tab === "modifier-groups") {
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Modifier groups" description="Examples: Choose Size (Small, Medium, Large), Choose Bread (White, Whole wheat).">
          <div className="admin-menu-form-grid admin-menu-form-grid--3">
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Item</span>
              <AdminSelect className="mt-1" value={newModItemId} onChange={(e) => setNewModItemId(e.target.value)}>
                <option value="">Select item…</option>
                {api.flatItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Group name</span>
              <AdminInput className="mt-1" placeholder="e.g. Choose Size" value={newModGroupName} onChange={(e) => setNewModGroupName(e.target.value)} />
            </AdminLabel>
            <div className="flex items-end">
              <AdminBtnPrimary
                disabled={busy || !newModItemId || !newModGroupName.trim() || !can("modifier_group", "create")}
                onClick={() =>
                  void runCreate(
                    () => createModifierGroup(token, restaurantId, newModItemId, { name: newModGroupName.trim() }),
                    `Modifier group "${newModGroupName.trim()}" added.`
                  )
                }
              >
                Create group
              </AdminBtnPrimary>
            </div>
          </div>
        </MenuSection>

        <MenuSection title="All modifier groups">
          {api.flatModifierGroups.length === 0 ? (
            <AdminEmptyState>No modifier groups yet — add Choose Size or Choose Bread to an item.</AdminEmptyState>
          ) : (
            <table className="admin-config-data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Item</th>
                  <th>Min select</th>
                  <th>Max select</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {api.flatModifierGroups.map((g) => (
                  <tr key={g.id}>
                    <td className="font-semibold admin-config-text">{g.name}</td>
                    <td className="admin-config-text-muted">{g.itemName}</td>
                    <td className="admin-config-text-subtle">{g.minSelect}</td>
                    <td className="admin-config-text-subtle">{g.maxSelect}</td>
                    <td className="admin-config-text-subtle">{g.optionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MenuSection>
      </div>
    );
  }

  if (tab === "modifier-options") {
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Modifier options" description="Each option: name, extra price, default, and availability.">
          <div className="admin-menu-form-grid admin-menu-form-grid--4">
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Group</span>
              <AdminSelect className="mt-1" value={newModGroupId} onChange={(e) => setNewModGroupId(e.target.value)}>
                <option value="">Select group…</option>
                {modifierGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Name</span>
              <AdminInput className="mt-1" placeholder="e.g. Large" value={newModOptionName} onChange={(e) => setNewModOptionName(e.target.value)} />
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Extra price</span>
              <AdminInput className="mt-1" value={newModOptionDelta} onChange={(e) => setNewModOptionDelta(e.target.value)} />
            </AdminLabel>
            <div className="flex items-end">
              <AdminBtnPrimary
                disabled={busy || !newModGroupId || !newModOptionName.trim() || !can("modifier_option", "create")}
                onClick={() => {
                  const d = Number(newModOptionDelta);
                  if (!Number.isFinite(d)) return pushToast("Invalid extra price", "error");
                  void runCreate(
                    () =>
                      createModifierOption(token, restaurantId, newModGroupId, {
                        name: newModOptionName.trim(),
                        priceDeltaCents: Math.round(d * 100)
                      }),
                    `Modifier "${newModOptionName.trim()}" added.`
                  ).then(() => setNewModOptionName(""));
                }}
              >
                Create option
              </AdminBtnPrimary>
            </div>
          </div>
        </MenuSection>

        <MenuSection title="All modifier options">
          {api.flatModifiers.length === 0 ? (
            <AdminEmptyState>No modifier options yet — add Small, Medium, Large, or similar choices.</AdminEmptyState>
          ) : (
            <table className="admin-config-data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Item</th>
                  <th>Extra price</th>
                  <th>Default</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {api.flatModifiers.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold admin-config-text">{m.name}</td>
                    <td className="admin-config-text-muted">{m.groupName}</td>
                    <td className="admin-config-text-subtle">{m.itemName}</td>
                    <td>{m.priceDeltaCents ? `+${formatMoneyCents(m.priceDeltaCents)}` : "—"}</td>
                    <td className="admin-config-text-subtle">—</td>
                    <td>
                      <MenuChip tone={m.isActive ? "success" : "muted"}>{m.isActive ? "Yes" : "No"}</MenuChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MenuSection>
      </div>
    );
  }

  if (tab === "availability") {
    const saveSlot = async (slot: (typeof AVAILABILITY_SLOTS)[number], enabled: boolean) => {
      setBusy(true);
      const menusRes = await listRestaurantMenus(token, restaurantId);
      const menuId = menusRes.menus?.[0]?.id;
      if (!menuId) {
        setBusy(false);
        pushToast("Create a menu first.", "error");
        return;
      }
      const res = await scheduleRestaurantMenu(token, restaurantId, menuId, {
        scheduledPublishAt: null,
        availabilityWindows: {
          [slot.key]: { enabled, start: slot.start, end: slot.end, days: [1, 2, 3, 4, 5, 6, 0] }
        }
      });
      setBusy(false);
      if (!res.ok) {
        pushToast(res.message ?? res.error ?? "Could not save availability", "error");
        return;
      }
      pushToast(`${slot.label} window saved.`, "success");
    };

    return (
      <MenuSection title="Availability" description="Schedule when menus and items are visible — breakfast, lunch, dinner, weekend, and holiday windows.">
        <div className="admin-menu-availability-grid">
          {AVAILABILITY_SLOTS.map((slot) => (
            <div key={slot.key} className="admin-menu-availability-card">
              <p className="font-display text-base font-bold admin-config-text">{slot.label}</p>
              <p className="admin-config-text-subtle mt-1 text-xs">
                {slot.start} – {slot.end}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <MenuToolbarButton disabled={busy} onClick={() => void saveSlot(slot, true)}>
                  Enable
                </MenuToolbarButton>
                <MenuToolbarButton disabled={busy} onClick={() => void saveSlot(slot, false)}>
                  Disable
                </MenuToolbarButton>
              </div>
            </div>
          ))}
        </div>
      </MenuSection>
    );
  }

  if (tab === "images") {
    const firstItem = api.flatItems[0] ?? null;
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection
          title="Menu images & videos"
          description="Item photos and short videos are managed per product on the Items tab. Select an item there to upload up to 10 images or 3 videos."
        >
          {!can("media", "view") ? (
            <p className="admin-config-text-subtle text-sm">Your role cannot view menu media.</p>
          ) : firstItem ? (
            <>
              <p className="admin-config-text-subtle text-sm">
                Quick manage for <strong className="admin-config-text">{firstItem.name}</strong> — select any item on the Items tab for others.
              </p>
              <MenuItemMediaGallery
                token={token}
                restaurantId={restaurantId}
                menuItemId={firstItem.id}
                itemName={firstItem.name}
                canUpload={can("media", "upload")}
                canRemove={can("media", "remove")}
                limits={capabilities?.limits ?? null}
              />
            </>
          ) : (
            <div className="admin-menu-image-placeholder mt-4">
              <p className="admin-config-text-subtle text-sm">Create an item first, then add images and videos from the Items tab.</p>
            </div>
          )}
        </MenuSection>
      </div>
    );
  }

  if (tab === "preview") {
    const previewCategories = categories.slice(0, 3);
    return (
      <MenuSection title="Menu preview" description="See how guests will experience the menu before publishing.">
        <div className="admin-menu-preview-grid">
          <MenuPreviewFrame label="Desktop preview" aspect="desktop">
            <div className="p-4 text-left text-sm">
              <p className="font-display text-lg font-bold">{venueName}</p>
              {previewCategories.map((c) => (
                <div key={c.id} className="mt-4">
                  <p className="font-semibold">{c.name}</p>
                  <ul className="mt-2 space-y-1 text-white/70">
                    {c.items.slice(0, 4).map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span>{i.name}</span>
                        <span>{formatMoneyCents(i.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </MenuPreviewFrame>
          <MenuPreviewFrame label="Mobile preview" aspect="mobile">
            <div className="p-3 text-left text-xs">
              {previewCategories[0] ? (
                <>
                  <p className="font-bold">{previewCategories[0].name}</p>
                  {previewCategories[0].items.slice(0, 3).map((i) => (
                    <p key={i.id} className="mt-2 text-white/70">
                      {i.name} · {formatMoneyCents(i.priceCents)}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-white/60">Add categories to preview.</p>
              )}
            </div>
          </MenuPreviewFrame>
          <MenuPreviewFrame label="QR preview" aspect="qr">
            <p className="p-4 text-center text-xs text-white/70">Use QR codes on the Menus tab to generate a scannable guest link.</p>
          </MenuPreviewFrame>
        </div>
      </MenuSection>
    );
  }

  if (tab === "import-export") {
    const downloadCsv = async (filename: string) => {
      setImportBusy(true);
      const res = await exportMenuCsv(token, restaurantId);
      setImportBusy(false);
      if (!res.ok || !res.csv) {
        pushToast("Export failed", "error");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      pushToast("Menu exported.", "success");
    };

    const importFromFile = async (file: File) => {
      setImportBusy(true);
      const csv = await file.text();
      const res = await importMenuCsv(token, restaurantId, csv);
      setImportBusy(false);
      if (!res.ok) {
        pushToast(res.message ?? res.error ?? "Import failed", "error");
        return;
      }
      pushToast(`Imported ${res.imported?.rows ?? 0} rows.`, "success");
      api.refresh();
    };

    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Menu import / export" description="Move catalog data in and out — CSV and Excel-compatible export.">
          <MenuActionRow>
            <MenuToolbarButton disabled={importBusy} onClick={() => void downloadCsv(`menu-${restaurantId}.csv`)}>
              Export CSV
            </MenuToolbarButton>
            <MenuToolbarButton disabled={importBusy}>
              <label className="cursor-pointer">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFromFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </MenuToolbarButton>
            <MenuToolbarButton disabled={importBusy} onClick={() => void downloadCsv(`menu-${restaurantId}.xlsx.csv`)}>
              Export Excel
            </MenuToolbarButton>
            <MenuToolbarButton disabled={importBusy}>
              <label className="cursor-pointer">
                Import Excel
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFromFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </MenuToolbarButton>
          </MenuActionRow>
        </MenuSection>
        <MenuSection title="POS migration" description="Import a CSV export from your legacy POS to bootstrap categories and items.">
          <p className="admin-config-text-subtle text-sm">Use Import CSV with a file that includes category, item, price_cents, and modifier columns.</p>
        </MenuSection>
      </div>
    );
  }

  return null;
}
