import { useMemo, useState } from "react";

import type { MenuSurfaceRow } from "../../../api";

import { publishRestaurantMenu } from "../../../api";

import { AdminSkeletonTable } from "../../AdminSkeleton";

import { useAdminToast } from "../../AdminToast";

import type { useAdminMenus } from "../useAdminMenus";

import { CreateMenuModal } from "./CreateMenuModal";

import {

  ArchiveMenuConfirmModal,

  DuplicateMenuConfirmModal,

  MenuQrGeneratorModal,

  ScheduleMenuModal

} from "./AdminMenuActionModals";

import {

  MenuActionRow,

  MenuChip,

  MenuReadonlyField,

  MenuSection,

  MenuToolbarButton

} from "./MenuPageUi";



type MenusApi = ReturnType<typeof useAdminMenus>;



type Props = {

  menusApi: MenusApi;

  token: string;

  restaurantId: string;

  venueName: string;

  initialLoading: boolean;

  canCreateMenu?: boolean;

  canPublishMenu?: boolean;

};



function menuDescription(menu: MenuSurfaceRow, venueName: string) {

  if (menu.description?.trim()) return menu.description.trim();

  switch (menu.surfaceKey) {

    case "main":

      return `Default guest menu for ${venueName || "this venue"}`;

    case "lunch":

      return "Weekday lunch service — schedule when multi-menu is enabled";

    case "dinner":

      return "Evening dining — share categories or build a dedicated set";

    case "drinks":

      return "Beverages, cocktails, and bar service";

    case "seasonal":

      return "Rotating seasonal items and limited-time offers";

    default:

      return `Draft menu surface for ${venueName || "this venue"}`;

  }

}



function statusLabel(status: MenuSurfaceRow["status"]) {

  if (status === "PUBLISHED") return "Live";

  if (status === "ARCHIVED") return "Archived";

  return "Draft";

}



function statusTone(status: MenuSurfaceRow["status"]) {

  if (status === "PUBLISHED") return "success" as const;

  if (status === "ARCHIVED") return "muted" as const;

  return "muted" as const;

}



export function AdminMenusTabPanel({

  menusApi,

  token,

  restaurantId,

  venueName,

  initialLoading,

  canCreateMenu = true,

  canPublishMenu = true

}: Props) {

  const { pushToast } = useAdminToast();

  const [createOpen, setCreateOpen] = useState(false);

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);

  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);



  const menus = menusApi.menus;

  const selectedMenuIdResolved = selectedMenuId ?? menus[0]?.id ?? null;



  const active = useMemo(

    () => menus.find((m) => m.id === selectedMenuIdResolved) ?? menus[0] ?? null,

    [menus, selectedMenuIdResolved]

  );



  const handlePublish = async (menu: MenuSurfaceRow) => {

    const res = await publishRestaurantMenu(token, restaurantId, menu.id);

    if (!res.ok) {

      pushToast(res.message ?? res.error ?? "Could not publish menu", "error");

      return;

    }

    pushToast(`“${menu.name}” is live for guests.`, "success");

    void menusApi.refresh();

  };



  if (initialLoading || menusApi.meta.initialLoading) {

    return <AdminSkeletonTable rows={4} columns={4} />;

  }



  return (

    <>

      <div className="admin-menu-tab-stack">

        <MenuSection

          title="Menus"

          description="Everything guests can order from — main, lunch, dinner, drinks, and seasonal surfaces."

          action={

            <MenuActionRow>

              <MenuToolbarButton primary disabled={!canCreateMenu} onClick={() => setCreateOpen(true)}>

                Create

              </MenuToolbarButton>

              <MenuToolbarButton disabled={!canPublishMenu || !active} onClick={() => void handlePublish(active!)}>

                Publish

              </MenuToolbarButton>

              <MenuToolbarButton disabled={!active} onClick={() => setDuplicateOpen(true)}>

                Duplicate

              </MenuToolbarButton>

              <MenuToolbarButton disabled={!active} onClick={() => setArchiveOpen(true)}>

                Archive

              </MenuToolbarButton>

              <MenuToolbarButton disabled={!active} onClick={() => setScheduleOpen(true)}>

                Schedule

              </MenuToolbarButton>

              <MenuToolbarButton onClick={() => setQrOpen(true)}>QR codes</MenuToolbarButton>

            </MenuActionRow>

          }

        >

          {menus.length === 0 ? (

            <p className="admin-config-text-muted px-4 py-6 text-sm">No menus yet. Create your first draft menu.</p>

          ) : (

            <ul className="admin-config-table divide-y divide-[var(--admin-border)]">

              {menus.map((m) => (

                <li key={m.id}>

                  <button

                    type="button"

                    className={`admin-config-row admin-menu-surface-row w-full px-4 py-4 text-left${selectedMenuIdResolved === m.id ? " admin-config-row--active" : ""}`}

                    onClick={() => setSelectedMenuId(m.id)}

                  >

                    <div className="flex flex-wrap items-start justify-between gap-3">

                      <div>

                        <p className="font-display text-lg font-bold admin-config-text">{m.name}</p>

                        <p className="mt-1 text-sm admin-config-text-muted">{menuDescription(m, venueName)}</p>

                        <p className="admin-config-text-subtle mt-2 text-xs">

                          {m.categoryCount} categories · {m.itemCount} items

                          {m.activeVersionNumber ? ` · v${m.activeVersionNumber}` : ""}

                        </p>

                      </div>

                      <MenuChip tone={statusTone(m.status)}>{statusLabel(m.status)}</MenuChip>

                    </div>

                  </button>

                </li>

              ))}

            </ul>

          )}

        </MenuSection>



        {active ? (

          <MenuSection title={`${active.name} details`} description="Surface metadata and publishing controls for the selected menu.">

            <div className="admin-menu-kv-grid">

              <MenuReadonlyField label="Menu name" value={active.name} />

              <MenuReadonlyField label="Status" value={statusLabel(active.status)} />

              <MenuReadonlyField label="Categories" value={String(active.categoryCount)} />

              <MenuReadonlyField label="Items" value={String(active.itemCount)} />

            </div>

            <p className="admin-config-text-subtle mt-4 text-xs">

              Draft menus are only visible in admin until published. Publishing creates an immutable snapshot for guests.

            </p>

          </MenuSection>

        ) : null}

      </div>



      <CreateMenuModal

        open={createOpen}

        venueName={venueName}

        token={token}

        restaurantId={restaurantId}

        onClose={() => setCreateOpen(false)}

        onCreated={(menu) => {

          menusApi.upsertMenu(menu);

          setSelectedMenuId(menu.id);

          pushToast(`“${menu.name}” draft created.`, "success");

          void menusApi.refresh();

        }}

      />



      <ArchiveMenuConfirmModal

        open={archiveOpen}

        menu={active}

        venueName={venueName}

        token={token}

        restaurantId={restaurantId}

        onClose={() => setArchiveOpen(false)}

        onArchived={() => {

          pushToast(`“${active?.name}” archived.`, "success");

          void menusApi.refresh();

        }}

      />



      <DuplicateMenuConfirmModal

        open={duplicateOpen}

        menu={active}

        token={token}

        restaurantId={restaurantId}

        onClose={() => setDuplicateOpen(false)}

        onDuplicated={(menu) => {

          menusApi.upsertMenu(menu);

          setSelectedMenuId(menu.id);

          pushToast(`“${menu.name}” draft created from duplicate.`, "success");

          void menusApi.refresh();

        }}

      />



      <ScheduleMenuModal

        open={scheduleOpen}

        menu={active}

        token={token}

        restaurantId={restaurantId}

        onClose={() => setScheduleOpen(false)}

        onScheduled={() => {

          pushToast("Menu schedule saved.", "success");

          void menusApi.refresh();

        }}

      />



      <MenuQrGeneratorModal

        open={qrOpen}

        token={token}

        restaurantId={restaurantId}

        onClose={() => setQrOpen(false)}

      />

    </>

  );

}

