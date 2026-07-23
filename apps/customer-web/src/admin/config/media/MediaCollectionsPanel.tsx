import { useState } from "react";
import {
  addMediaCollectionItems,
  createMediaCollection,
  deleteMediaCollection,
  updateMediaCollection,
  type MediaCollectionRow,
  type MediaLibraryAsset
} from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";

type Props = {
  token: string;
  restaurantId: string;
  collections: MediaCollectionRow[];
  assets: MediaLibraryAsset[];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
};

export function MediaCollectionsPanel({
  token,
  restaurantId,
  collections,
  assets,
  canEdit,
  onRefresh
}: Props) {
  const { pushToast } = useAdminToast();
  const [name, setName] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!canEdit || !name.trim()) return;
    setBusy(true);
    const res = await createMediaCollection(token, restaurantId, { name: name.trim() });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not create collection.", "error");
      return;
    }
    setName("");
    pushToast("Collection created.", "success");
    await onRefresh();
  };

  const rename = async (id: string, next: string) => {
    if (!canEdit || !next.trim()) return;
    const res = await updateMediaCollection(token, restaurantId, id, { name: next.trim() });
    if (!res.ok) pushToast(res.message ?? "Rename failed.", "error");
    else await onRefresh();
  };

  const remove = async (id: string) => {
    if (!canEdit) return;
    const res = await deleteMediaCollection(token, restaurantId, id);
    if (!res.ok) pushToast(res.message ?? "Delete failed.", "error");
    else {
      if (selectedCollection === id) setSelectedCollection(null);
      await onRefresh();
    }
  };

  const addSelectedAsset = async (assetId: string) => {
    if (!canEdit || !selectedCollection) return;
    const res = await addMediaCollectionItems(token, restaurantId, selectedCollection, [assetId]);
    if (!res.ok) pushToast(res.message ?? "Could not add asset.", "error");
    else {
      pushToast("Added to collection.", "success");
      await onRefresh();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm admin-config-text-muted">
          Collections are virtual — one asset can belong to many. They do not move files in storage.
        </p>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <input
              className="admin-config-input flex-1"
              placeholder="New collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <AdminBtnPrimary disabled={busy || !name.trim()} onClick={() => void create()}>
              Create
            </AdminBtnPrimary>
          </div>
        ) : null}
        <ul className="space-y-2">
          {collections.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl border p-3${selectedCollection === c.id ? " border-slate-400" : " border-slate-200"}`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setSelectedCollection(c.id)}
              >
                <p className="font-semibold admin-config-text">{c.name}</p>
                <p className="text-xs admin-config-text-muted">{c.itemCount} assets</p>
              </button>
              {canEdit ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <AdminBtnSecondary
                    onClick={() => {
                      const next = window.prompt("Rename collection", c.name);
                      if (next) void rename(c.id, next);
                    }}
                  >
                    Rename
                  </AdminBtnSecondary>
                  <AdminBtnSecondary onClick={() => void remove(c.id)}>Delete</AdminBtnSecondary>
                </div>
              ) : null}
            </li>
          ))}
          {collections.length === 0 ? (
            <p className="text-sm admin-config-text-muted">No collections yet.</p>
          ) : null}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide admin-config-text-muted">
          {selectedCollection ? "Add library assets" : "Select a collection"}
        </p>
        {selectedCollection ? (
          <div className="admin-menu-media-grid">
            {assets.slice(0, 24).map((a) => (
              <button
                key={a.id}
                type="button"
                className="admin-menu-media-card text-left"
                disabled={!canEdit}
                onClick={() => void addSelectedAsset(a.id)}
              >
                {a.url && a.contentType.startsWith("image/") ? (
                  <img
                    src={a.url}
                    alt=""
                    className="admin-menu-media-card__preview"
                  />
                ) : (
                  <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">
                    Media
                  </div>
                )}
                <div className="admin-menu-media-card__meta">
                  <span className="truncate text-xs">{a.displayName || a.originalName}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm admin-config-text-muted">Choose a collection to add assets.</p>
        )}
      </div>
    </div>
  );
}
