import { useState } from "react";
import { deleteModifierGroup, deleteModifierOption } from "../../../api";
import { ProfileModalAlert, ProfileModalFooter, ProfileModalShell } from "../../profile/ProfileModalShell";

type DeleteGroupProps = {
  open: boolean;
  groupName: string | null;
  token: string;
  restaurantId: string;
  groupId: string | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteModifierGroupModal({ open, groupName, token, restaurantId, groupId, onClose, onDeleted }: DeleteGroupProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!groupId) return;
    setBusy(true);
    setError(null);
    const res = await deleteModifierGroup(token, restaurantId, groupId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not delete modifier group");
      return;
    }
    onDeleted();
    onClose();
  };

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete modifier group?"
      description={`“${groupName ?? "This group"}” and its options will be removed. This cannot be undone.`}
      titleId="delete-modifier-group-title"
      stackLevel="overlay"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete group"}
        busy={busy}
        confirmDisabled={!groupId}
        danger
      />
    </ProfileModalShell>
  );
}

type DeleteOptionProps = {
  open: boolean;
  optionName: string | null;
  token: string;
  restaurantId: string;
  optionId: string | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteModifierOptionModal({ open, optionName, token, restaurantId, optionId, onClose, onDeleted }: DeleteOptionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!optionId) return;
    setBusy(true);
    setError(null);
    const res = await deleteModifierOption(token, restaurantId, optionId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not delete modifier option");
      return;
    }
    onDeleted();
    onClose();
  };

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete modifier option?"
      description={`“${optionName ?? "This option"}” will be removed from its group. This cannot be undone.`}
      titleId="delete-modifier-option-title"
      stackLevel="overlay"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete option"}
        busy={busy}
        confirmDisabled={!optionId}
        danger
      />
    </ProfileModalShell>
  );
}
