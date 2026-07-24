import { useMemo, useState } from "react";
import type { MediaCollectionRow } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";

type Props = {
  open: boolean;
  collections: MediaCollectionRow[];
  assetName: string;
  currentCollectionIds?: string[];
  onClose: () => void;
  onPick: (collectionId: string) => void;
};

export function MediaMoveToCollectionModal({
  open,
  collections,
  assetName,
  currentCollectionIds = [],
  onClose,
  onPick
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = useMemo(
    () => collections.filter((c) => !currentCollectionIds.includes(c.id)),
    [collections, currentCollectionIds]
  );

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Move to collection"
      description={`Choose a collection for “${assetName}”.`}
      titleId="media-move-collection"
      maxWidthClass="max-w-md"
      bodyScroll={false}
    >
      {collections.length === 0 ? (
        <p className="text-sm admin-config-text-muted">No collections yet. Create one under Collections.</p>
      ) : options.length === 0 ? (
        <p className="text-sm admin-config-text-muted">Already in every available collection.</p>
      ) : (
        <div className="admin-menu-manage-actions max-h-64 overflow-y-auto">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`admin-menu-manage-action${selected === c.id ? " is-selected" : ""}`}
              onClick={() => setSelected(c.id)}
            >
              <span className="admin-menu-manage-action-label">{c.name}</span>
              <span className="admin-menu-manage-action-desc">
                {c.itemCount} asset{c.itemCount === 1 ? "" : "s"}
                {c.description ? ` · ${c.description}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      <ProfileModalFooter
        cancelLabel="Cancel"
        onCancel={onClose}
        confirmLabel="Move"
        confirmDisabled={!selected}
        onConfirm={() => {
          if (!selected) return;
          onPick(selected);
        }}
      />
    </MenuPageModalShell>
  );
}
