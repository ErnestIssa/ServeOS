import { useEffect, useMemo, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  createCategory,
  createMenuItem,
  createModifierGroup,
  createModifierOption
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
};

const MENU_SURFACES = [
  { id: "main", name: "Main Menu", example: true },
  { id: "lunch", name: "Lunch Menu", example: true },
  { id: "dinner", name: "Dinner Menu", example: true },
  { id: "drinks", name: "Drinks", example: true },
  { id: "seasonal", name: "Seasonal Menu", example: true }
] as const;

const AVAILABILITY_SLOTS = ["Breakfast", "Lunch", "Dinner", "Weekend", "Holiday"] as const;

export function AdminMenuTabContent({ tab, api, token, restaurantId, venueName, initialLoading }: Props) {
  const { pushToast } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState("main");
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

  const menuSurfaces = useMemo(
    () =>
      MENU_SURFACES.map((m) => ({
        ...m,
        description:
          m.id === "main"
            ? `Default guest menu for ${venueName || "this venue"}`
            : m.id === "lunch"
              ? "Weekday lunch service — schedule when multi-menu is enabled"
              : m.id === "dinner"
                ? "Evening dining — share categories or build a dedicated set"
                : m.id === "drinks"
                  ? "Beverages, cocktails, and bar service"
                  : "Rotating seasonal items and limited-time offers",
        categories: m.id === "main" ? api.stats.categories : 0,
        items: m.id === "main" ? api.stats.items : 0,
        status: m.id === "main" ? ("live" as const) : ("draft" as const)
      })),
    [venueName, api.stats.categories, api.stats.items]
  );

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

  const futureToast = (label: string) => pushToast(`${label} ships in a future release.`, "success");

  if (initialLoading) {
    const rows = tab === "items" ? 8 : tab === "categories" ? 6 : 4;
    const cols = tab === "items" ? 5 : 4;
    return <AdminSkeletonTable rows={rows} columns={cols} />;
  }

  if (tab === "menus") {
    const active = menuSurfaces.find((m) => m.id === selectedMenuId) ?? menuSurfaces[0];
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection
          title="Menus"
          description="Everything guests can order from — main, lunch, dinner, drinks, and seasonal surfaces."
          action={
            <MenuActionRow>
              <MenuToolbarButton primary disabled={busy} onClick={() => futureToast("Create menu")}>
                Create
              </MenuToolbarButton>
              <MenuToolbarButton disabled={busy} onClick={() => futureToast("Duplicate menu")}>
                Duplicate
              </MenuToolbarButton>
              <MenuToolbarButton disabled={busy} onClick={() => futureToast("Archive menu")}>
                Archive
              </MenuToolbarButton>
              <MenuToolbarButton disabled={busy} onClick={() => futureToast("Schedule menu")}>
                Schedule
              </MenuToolbarButton>
            </MenuActionRow>
          }
        >
          <ul className="admin-config-table divide-y divide-[var(--admin-border)]">
            {menuSurfaces.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`admin-config-row admin-menu-surface-row w-full px-4 py-4 text-left${selectedMenuId === m.id ? " admin-config-row--active" : ""}`}
                  onClick={() => setSelectedMenuId(m.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-bold admin-config-text">{m.name}</p>
                      <p className="mt-1 text-sm admin-config-text-muted">{m.description}</p>
                      <p className="admin-config-text-subtle mt-2 text-xs">
                        {m.categories} categories · {m.items} items
                      </p>
                    </div>
                    <MenuChip tone={m.status === "live" ? "success" : "muted"}>{m.status === "live" ? "Live" : "Draft"}</MenuChip>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </MenuSection>

        <MenuSection title={`${active.name} details`} description="Surface metadata and publishing controls for the selected menu.">
          <div className="admin-menu-kv-grid">
            <MenuReadonlyField label="Menu name" value={active.name} />
            <MenuReadonlyField label="Status" value={active.status === "live" ? "Live" : "Draft"} />
            <MenuReadonlyField label="Categories" value={String(active.categories)} />
            <MenuReadonlyField label="Items" value={String(active.items)} />
          </div>
          <p className="admin-config-text-subtle mt-4 text-xs">
            Examples: Main Menu, Lunch Menu, Dinner Menu, Drinks, Seasonal Menu. Multi-menu scheduling connects here when enabled.
          </p>
        </MenuSection>
      </div>
    );
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
              disabled={busy || !newCategoryName.trim()}
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
                disabled={busy || !newItemName.trim() || !newItemCategoryId}
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
                <MenuReadonlyField label="Image" value="Not uploaded" />
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
                disabled={busy || !newModItemId || !newModGroupName.trim()}
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
                disabled={busy || !newModGroupId || !newModOptionName.trim()}
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
    return (
      <MenuSection title="Availability" description="Schedule when menus and items are visible — breakfast, lunch, dinner, weekend, and holiday windows.">
        <div className="admin-menu-availability-grid">
          {AVAILABILITY_SLOTS.map((slot) => (
            <div key={slot} className="admin-menu-availability-card">
              <p className="font-display text-base font-bold admin-config-text">{slot}</p>
              <p className="admin-config-text-subtle mt-1 text-xs">No schedule configured</p>
              <MenuToolbarButton disabled={busy} onClick={() => futureToast(`${slot} schedule`)}>
                Configure
              </MenuToolbarButton>
            </div>
          ))}
        </div>
      </MenuSection>
    );
  }

  if (tab === "images") {
    return (
      <MenuSection title="Menu images" description="Upload, crop, optimize, and delete hero and category imagery.">
        <MenuActionRow>
          <MenuToolbarButton primary disabled={busy} onClick={() => futureToast("Upload")}>
            Upload
          </MenuToolbarButton>
          <MenuToolbarButton disabled={busy} onClick={() => futureToast("Delete")}>
            Delete
          </MenuToolbarButton>
          <MenuToolbarButton disabled={busy} onClick={() => futureToast("Crop")}>
            Crop
          </MenuToolbarButton>
          <MenuToolbarButton disabled={busy} onClick={() => futureToast("Optimize")}>
            Optimize
          </MenuToolbarButton>
        </MenuActionRow>
        <div className="admin-menu-image-placeholder mt-4">
          <p className="admin-config-text-subtle text-sm">No menu images uploaded yet.</p>
        </div>
      </MenuSection>
    );
  }

  if (tab === "preview") {
    return (
      <MenuSection title="Menu preview" description="See how guests will experience the menu before publishing.">
        <div className="admin-menu-preview-grid">
          <MenuPreviewFrame label="Desktop preview" aspect="desktop" />
          <MenuPreviewFrame label="Mobile preview" aspect="mobile" />
          <MenuPreviewFrame label="QR preview" aspect="qr" />
        </div>
      </MenuSection>
    );
  }

  if (tab === "import-export") {
    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Menu import / export" description="Move catalog data in and out — CSV, Excel, and future POS migration.">
          <MenuActionRow>
            <MenuToolbarButton disabled={busy} onClick={() => futureToast("CSV export")}>
              Export CSV
            </MenuToolbarButton>
            <MenuToolbarButton disabled={busy} onClick={() => futureToast("CSV import")}>
              Import CSV
            </MenuToolbarButton>
            <MenuToolbarButton disabled={busy} onClick={() => futureToast("Excel export")}>
              Export Excel
            </MenuToolbarButton>
            <MenuToolbarButton disabled={busy} onClick={() => futureToast("Excel import")}>
              Import Excel
            </MenuToolbarButton>
          </MenuActionRow>
        </MenuSection>
        <MenuSection title="Future POS migration" description="One-click migration from legacy POS systems when connectors are available.">
          <p className="admin-config-text-subtle text-sm">POS migration tools will appear here when your integration is ready.</p>
          <MenuToolbarButton disabled={busy} onClick={() => futureToast("POS migration")}>
            Start migration
          </MenuToolbarButton>
        </MenuSection>
      </div>
    );
  }

  return null;
}
