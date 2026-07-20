import { MenuPageModalShell, ProfileModalFooter } from "./menuPageModalShell";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  titleId?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** Shared confirm step before ⋯ row actions that change state or open a follow-up flow. */
export function MenuActionConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  busy = false,
  danger = false,
  titleId = "menu-action-confirm-title",
  onClose,
  onConfirm
}: Props) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      titleId={titleId}
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
    >
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel={busy ? "Working…" : confirmLabel}
        busy={busy}
        danger={danger}
      />
    </MenuPageModalShell>
  );
}
