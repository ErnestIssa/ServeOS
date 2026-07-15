import { useEffect, useState } from "react";
import { createOrderingSession, getOrderingSessionQr } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { ProfileModalAlert } from "../../profile/ProfileModalShell";

type Props = {
  token: string;
  restaurantId: string;
  compact?: boolean;
};

export function MenuQrGeneratorContent({ token, restaurantId, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [pngDownloadUrl, setPngDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    setMenuUrl(null);
    setQrImageUrl(null);
    setPngDownloadUrl(null);
    setError(null);
    setTableLabel("");
  }, [restaurantId]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const created = await createOrderingSession(token, restaurantId, {
      tableLabel: tableLabel.trim() || undefined,
      paymentMode: "PAY_AT_VENUE"
    });
    if (!created.ok || !created.session) {
      setBusy(false);
      setError(created.message ?? created.error ?? "Could not create session");
      return;
    }
    const qr = await getOrderingSessionQr(token, restaurantId, created.session.id);
    setBusy(false);
    if (!qr.ok) {
      setError(qr.message ?? qr.error ?? "Could not load QR");
      return;
    }
    setMenuUrl(qr.menuUrl ?? created.session.menuUrl);
    setQrImageUrl(qr.qrImageUrl ?? null);
    setPngDownloadUrl(qr.pngDownloadUrl ?? null);
  };

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <AdminLabel>
        <span className="text-xs admin-config-text-muted">Table label (optional)</span>
        <AdminInput
          className="mt-1"
          placeholder="e.g. Table 12"
          value={tableLabel}
          onChange={(e) => setTableLabel(e.target.value)}
        />
      </AdminLabel>

      {menuUrl ? (
        <div className="admin-menu-qr-preview rounded-xl border p-4 text-center">
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="Ordering QR code" className="mx-auto h-48 w-48 rounded-lg border bg-white p-2" />
          ) : null}
          <p className="admin-config-text-subtle mt-3 break-all text-xs">{menuUrl}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {pngDownloadUrl ? (
              <a
                className="admin-btn-secondary inline-flex"
                href={pngDownloadUrl}
                download="serveos-menu-qr.png"
                target="_blank"
                rel="noreferrer"
              >
                Download PNG
              </a>
            ) : null}
            <button type="button" className="admin-btn-secondary" onClick={() => void navigator.clipboard.writeText(menuUrl)}>
              Copy link
            </button>
          </div>
        </div>
      ) : null}

      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="admin-staff-invite-submit admin-menu-create-submit" disabled={busy} onClick={() => void generate()}>
          {busy ? "Generating…" : menuUrl ? "Generate new QR" : "Generate QR"}
        </button>
        {menuUrl ? (
          <AdminBtnSecondary type="button" disabled={busy} onClick={() => void generate()}>
            Refresh
          </AdminBtnSecondary>
        ) : null}
      </div>
    </div>
  );
}
