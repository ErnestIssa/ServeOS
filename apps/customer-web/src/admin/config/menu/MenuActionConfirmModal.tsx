import { ProfileModalFooter, ProfileModalShell } from "../../profile/ProfileModalShell";

type Props = {
  open: boolean;
  title?: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  titleId?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Confirm step before actions that change state.
 * Description-only (no topic heading).
 */
export function MenuActionConfirmModal({
  open,
  title: _title,
  description,
  confirmLabel = "Confirm",
  busy = false,
  danger = false,
  titleId = "menu-action-confirm-title",
  onClose,
  onConfirm
}: Props) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title=""
      description={description}
      titleId={titleId}
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
      maxHeightClass="max-h-none"
      bodyScroll={false}
      backdropClassName="admin-menu-page-modal-backdrop"
    >
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        busy={busy}
        danger={danger}
      />
    </ProfileModalShell>
  );
}
