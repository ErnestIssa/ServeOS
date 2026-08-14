import { useEffect, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  createVenuePaymentMethodDangerChallenge,
  executeVenuePaymentMethodDangerAction,
  getVenuePaymentMethodDangerZone,
  type PaymentDangerChallenge,
  type PaymentMethodCapabilitiesPayload,
  type PaymentMethodDangerAction,
  type PaymentMethodDangerZone,
  type VenuePaymentSettings
} from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import {
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote
} from "../menu/menuPageModalShell";

type Props = {
  token: string;
  restaurantId: string;
  methodKey: string | null;
  canEdit: boolean;
  open: boolean;
  onToast: (message: string, tone?: "success" | "error") => void;
  onCompleted: (payload: {
    settings?: VenuePaymentSettings;
    methodCapabilities?: PaymentMethodCapabilitiesPayload;
  }) => void;
};

function normalizePhrase(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function PaymentMethodDangerZoneSection({
  token,
  restaurantId,
  methodKey,
  canEdit,
  open,
  onToast,
  onCompleted
}: Props) {
  const [zone, setZone] = useState<PaymentMethodDangerZone | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PaymentMethodDangerAction | null>(null);
  const [challenge, setChallenge] = useState<PaymentDangerChallenge | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open || !methodKey || !token || !restaurantId) {
      setZone(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getVenuePaymentMethodDangerZone(token, restaurantId, methodKey).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.dangerZone) {
        setError(res.message ?? res.error ?? "Could not load danger zone.");
        setZone(null);
        return;
      }
      setZone(res.dangerZone);
    });
    return () => {
      cancelled = true;
    };
  }, [open, methodKey, token, restaurantId]);

  useEffect(() => {
    if (pendingAction) return;
    setChallenge(null);
    setTyped("");
    setError(null);
  }, [pendingAction]);

  const matches = useMemo(() => {
    if (!challenge) return false;
    return normalizePhrase(typed) === normalizePhrase(challenge.phrase);
  }, [typed, challenge]);

  const blockClipboard = (e: ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
  };

  const blockCopyKeys = (e: KeyboardEvent<HTMLElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X" || e.key === "v" || e.key === "V")) {
      e.preventDefault();
    }
  };

  const startAction = async (action: PaymentMethodDangerAction) => {
    if (!canEdit || !methodKey || !action.available || busy) return;
    setBusy(true);
    setError(null);
    setPendingAction(action);
    setTyped("");
    const res = await createVenuePaymentMethodDangerChallenge(token, restaurantId, methodKey, action.id);
    setBusy(false);
    if (!res.ok || !res.challenge || !res.action) {
      setPendingAction(null);
      setError(res.message ?? res.error ?? "Could not start confirmation.");
      onToast(res.message ?? res.error ?? "Could not start confirmation.", "error");
      return;
    }
    setChallenge(res.challenge);
    setPendingAction(res.action);
    if (res.dangerZone) setZone(res.dangerZone);
  };

  const confirmAction = async () => {
    if (!canEdit || !methodKey || !pendingAction || !challenge || !matches || busy) return;
    setBusy(true);
    setError(null);
    const res = await executeVenuePaymentMethodDangerAction(token, restaurantId, methodKey, {
      actionId: pendingAction.id,
      challengeId: challenge.id,
      typedPhrase: typed
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Action failed.");
      onToast(res.message ?? res.error ?? "Action failed.", "error");
      if (res.error === "challenge_expired" || res.error === "challenge_invalid") {
        setPendingAction(null);
        setChallenge(null);
        setTyped("");
      }
      return;
    }
    onCompleted({ settings: res.settings, methodCapabilities: res.methodCapabilities });
    if (res.dangerZone) setZone(res.dangerZone);
    onToast(res.message ?? `${pendingAction.label} completed.`, "success");
    setPendingAction(null);
    setChallenge(null);
    setTyped("");
  };

  if (!open || !methodKey) return null;

  const availableActions = (zone?.actions ?? []).filter((a) => a.available);
  const unavailableActions = (zone?.actions ?? []).filter((a) => !a.available);

  return (
    <>
      <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
        <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
        <p className="admin-config-text-subtle text-xs mb-2">
          Destructive actions are decided by the backend for this method’s current state. Each action requires typing a
          fresh confirmation phrase.
        </p>
        {loading && !zone ? (
          <p className="admin-config-text-subtle text-sm">Loading danger zone…</p>
        ) : null}
        {error && !pendingAction ? (
          <p className="admin-payments-source-status is-error" role="alert">
            {error}
          </p>
        ) : null}
        {zone ? (
          <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous payment method actions">
            {availableActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="admin-menu-manage-danger-btn"
                disabled={!canEdit || busy}
                onClick={() => void startAction(action)}
              >
                <span className="admin-menu-manage-danger-btn-label">{action.label}</span>
                <span className="admin-menu-manage-danger-btn-desc">{action.description}</span>
              </button>
            ))}
            {!availableActions.length ? (
              <p className="admin-config-text-subtle text-sm">No destructive actions are available for this method right now.</p>
            ) : null}
          </div>
        ) : null}
        {unavailableActions.length ? (
          <ul className="admin-payments-danger-unavailable mt-2">
            {unavailableActions.map((action) => (
              <li key={action.id}>
                <strong>{action.label}</strong>
                <span>{action.unavailableReason}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <MenuPageModalShell
        open={Boolean(pendingAction && challenge)}
        onClose={busy ? () => undefined : () => setPendingAction(null)}
        title={pendingAction?.label ?? "Confirm action"}
        description="Review the consequences, then type the confirmation phrase exactly. Pasting and copying are disabled."
        titleId="payment-method-danger-confirm"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        busy={busy}
      >
        {pendingAction ? (
          <div className="admin-payments-danger-confirm">
            <ProfileModalNote>
              <ul className="admin-payments-danger-consequences">
                {pendingAction.consequences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </ProfileModalNote>

            <div className="admin-payments-danger-phrase-block">
              <p className="admin-config-text-subtle text-xs mb-1">Type this phrase</p>
              <p
                className="admin-payments-danger-phrase"
                aria-label="Confirmation phrase"
                onCopy={blockClipboard}
                onCut={blockClipboard}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={blockCopyKeys}
              >
                {challenge?.phrase}
              </p>
            </div>

            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Confirmation phrase</span>
              <AdminInput
                className="mt-1 admin-payments-danger-phrase-input"
                value={typed}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
                onChange={(e) => setTyped(e.target.value)}
                onPaste={blockClipboard}
                onCopy={blockClipboard}
                onCut={blockClipboard}
                onDrop={(e) => e.preventDefault()}
                onKeyDown={blockCopyKeys}
              />
            </AdminLabel>

            {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

            <ProfileModalFooter
              cancelLabel="Cancel"
              confirmLabel={pendingAction.confirmLabel}
              danger
              busy={busy}
              confirmDisabled={!matches}
              onCancel={() => setPendingAction(null)}
              onConfirm={() => void confirmAction()}
            />
          </div>
        ) : null}
      </MenuPageModalShell>
    </>
  );
}
