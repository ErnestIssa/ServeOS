import { useState } from "react";
import type { QrCodeRow } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { MenuPageModalShell, ProfileModalAlert } from "../menu/menuPageModalShell";
import { ConfigDrawerSpinner } from "../configLoadingUi";

type Props = {
  open: boolean;
  qr: QrCodeRow | null;
  onClose: () => void;
};

function downloadFromBackendUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Print via a hidden iframe (same tab) so browsers don't treat it as a pop-up.
 * Uses the backend-provided image URL (SSOT).
 */
function printBackendQrImage(url: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const safeTitle = title.replace(/[<>&"]/g, "");
    const safeUrl = url.replace(/"/g, "&quot;");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 800);
    };

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      reject(new Error("Could not prepare print view."));
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { margin: 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; }
    h1 { font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 16px; text-align: center; }
    img { width: min(72mm, 90vw); height: auto; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <img src="${safeUrl}" alt="QR code" />
</body>
</html>`);
    doc.close();

    const img = doc.querySelector("img");
    if (!img) {
      cleanup();
      reject(new Error("Could not prepare print view."));
      return;
    }

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        cleanup();
        resolve();
      } catch {
        cleanup();
        reject(new Error("Could not open the print dialog."));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("Could not load the QR image for printing."));
    };

    if (img.complete && img.naturalWidth > 0) {
      window.setTimeout(triggerPrint, 50);
    } else {
      img.onload = () => window.setTimeout(triggerPrint, 50);
    }
  });
}

function CopyIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * Confirm print / download for a QR identity.
 * Asset URLs come from the API (SSOT) — never regenerated client-side.
 */
export function QrPrintConfirmModal({ open, qr, onClose }: Props) {
  const { pushToast } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!qr) return null;

  const baseName = `${qr.name.replace(/[^\w\-]+/g, "_").slice(0, 48) || "qr"}-${qr.publicCode}`;

  const copyPublicCode = async () => {
    try {
      await navigator.clipboard.writeText(qr.publicCode);
      setCopied(true);
      pushToast("QR ID copied.", "success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      pushToast("Could not copy QR ID.", "error");
    }
  };

  const runDownload = (kind: "png" | "svg") => {
    setError(null);
    setBusy(true);
    try {
      const url = kind === "png" ? qr.pngDownloadUrl : qr.svgDownloadUrl;
      downloadFromBackendUrl(url, `${baseName}.${kind}`);
      pushToast(`Downloading ${kind.toUpperCase()}…`, "success");
      onClose();
    } catch {
      setError("Could not start download.");
    } finally {
      setBusy(false);
    }
  };

  const runPrint = () => {
    setError(null);
    setBusy(true);
    void printBackendQrImage(qr.pngDownloadUrl, qr.name)
      .then(() => {
        pushToast("Print dialog opened.", "success");
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open the print dialog.");
      })
      .finally(() => setBusy(false));
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Print QR"
      description={`Print or download “${qr.name}”. This uses the current QR shown on the card.`}
      titleId="qr-print-confirm-title"
      maxWidthClass="max-w-md"
      stackLevel="overlay"
      busy={busy}
    >
      {busy ? (
        <ConfigDrawerSpinner label="Preparing print" />
      ) : (
        <>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      <div className="mb-5 flex justify-center">
        <img
          src={qr.qrImageUrl}
          alt={`Preview of ${qr.name}`}
          className="h-36 w-36 rounded-xl border border-slate-200 bg-white object-contain p-2 shadow-sm"
        />
      </div>

      <div className="mb-5 flex items-center justify-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">QR ID</span>
        <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-800">{qr.publicCode}</code>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          aria-label={copied ? "Copied" : "Copy QR ID"}
          title={copied ? "Copied" : "Copy QR ID"}
          onClick={() => void copyPublicCode()}
        >
          {copied ? (
            <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>

      <div className="grid gap-3">
        <AdminBtnPrimary disabled={busy} onClick={runPrint} className="w-full">
          Print with device
        </AdminBtnPrimary>
        <div className="grid grid-cols-2 gap-2">
          <AdminBtnSecondary disabled={busy} onClick={() => runDownload("png")} className="w-full">
            Download PNG
          </AdminBtnSecondary>
          <AdminBtnSecondary disabled={busy} onClick={() => runDownload("svg")} className="w-full">
            Download SVG
          </AdminBtnSecondary>
        </div>
      </div>
        </>
      )}
    </MenuPageModalShell>
  );
}
