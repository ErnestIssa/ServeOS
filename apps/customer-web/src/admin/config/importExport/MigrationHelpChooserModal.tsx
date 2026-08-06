import { MenuPageModalShell } from "../menu/menuPageModalShell";

type Props = {
  open: boolean;
  onClose: () => void;
  onChooseGuide: () => void;
  onChooseManual: () => void;
};

export function MigrationHelpChooserModal({ open, onClose, onChooseGuide, onChooseManual }: Props) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Need help?"
      description="Choose what you need for this migration."
      titleId="data-transfer-migration-help-chooser"
      maxWidthClass="max-w-md"
      panelClassName="data-transfer-migration-help-chooser"
    >
      <div className="data-transfer-migration-help-options" role="list">
        <button
          type="button"
          className="data-transfer-migration-help-option"
          role="listitem"
          onClick={onChooseGuide}
        >
          <span className="data-transfer-migration-help-option-title">Migration guide</span>
          <span className="data-transfer-migration-help-option-desc">
            Walk through each step — choose system, upload, map, preview, import, and verify.
          </span>
        </button>

        <button
          type="button"
          className="data-transfer-migration-help-option"
          role="listitem"
          onClick={onChooseManual}
        >
          <span className="data-transfer-migration-help-option-title">Request manual migration</span>
          <span className="data-transfer-migration-help-option-desc">
            Ask ServeOS to help move data from your current system. A specialist will follow up.
          </span>
        </button>
      </div>
    </MenuPageModalShell>
  );
}
