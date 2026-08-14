import { useEffect, useMemo, useState } from "react";
import {
  startVenuePaymentMethodSetup,
  submitVenuePaymentMethodSetupStep,
  type PaymentSetupSession,
  type PaymentSetupSessionField
} from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import {
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote
} from "../menu/menuPageModalShell";
import { ConfigModalContentGate } from "../configLoadingUi";

type Props = {
  open: boolean;
  token: string;
  restaurantId: string;
  methodKey: string | null;
  methodLabel: string;
  canEdit: boolean;
  onClose: () => void;
  onCompleted: (payload: {
    settings?: import("../../../api").VenuePaymentSettings;
    methodCapabilities?: import("../../../api").PaymentMethodCapabilitiesPayload;
  }) => void;
  onToast: (message: string, tone?: "success" | "error") => void;
};

function FieldInput({
  field,
  value,
  onChange,
  disabled
}: {
  field: PaymentSetupSessionField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="admin-payments-setup-check">
        <input
          type="checkbox"
          checked={Boolean(value ?? true)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }
  if (field.type === "multiselect" && field.options) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="admin-payments-setup-multiselect">
        {field.options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <label key={opt.value} className="admin-payments-setup-check">
              <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={() => {
                  onChange(on ? selected.filter((v) => v !== opt.value) : [...selected, opt.value]);
                }}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (field.type === "file") {
    return (
      <textarea
        className="admin-payments-select"
        rows={4}
        disabled={disabled}
        placeholder={
          field.configured ? "Configured — paste a new certificate to replace" : field.placeholder ?? "Paste PEM contents"
        }
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <AdminInput
      type={field.type === "secret" ? "password" : "text"}
      disabled={disabled}
      placeholder={
        field.configured && field.secret
          ? "Configured — enter a new value to rotate"
          : field.placeholder ?? ""
      }
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
    />
  );
}

export function PaymentMethodSetupWizard({
  open,
  token,
  restaurantId,
  methodKey,
  methodLabel,
  canEdit,
  onClose,
  onCompleted,
  onToast
}: Props) {
  const [session, setSession] = useState<PaymentSetupSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !methodKey || !token || !restaurantId) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    setValues({});
    void startVenuePaymentMethodSetup(token, restaurantId, methodKey).then((res) => {
      if (cancelled) return;
      setBusy(false);
      if (!res.ok || !res.session) {
        setError(res.message ?? res.error ?? "Could not start setup.");
        return;
      }
      setSession(res.session);
      if (res.settings || res.methodCapabilities) {
        onCompleted({ settings: res.settings, methodCapabilities: res.methodCapabilities });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, methodKey, token, restaurantId]);

  const currentStep = useMemo(() => {
    if (!session) return null;
    return (
      session.steps.find((s) => s.id === session.currentStep) ??
      session.steps.find((s) => s.status === "CURRENT" || s.status === "REQUIRED") ??
      null
    );
  }, [session]);

  const submitCurrent = async (asEnable = false) => {
    if (!session || !methodKey || !canEdit) return;
    const stepId = asEnable ? "ACTIVATE" : currentStep?.id;
    if (!stepId) return;
    setBusy(true);
    setError(null);
    const res = await submitVenuePaymentMethodSetupStep(token, restaurantId, methodKey, stepId, {
      expectedVersion: session.version,
      values: asEnable ? { ...values, confirmEnable: true } : values
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Setup step failed.");
      if (res.session) setSession(res.session);
      onToast(res.message ?? res.error ?? "Setup step failed.", "error");
      return;
    }
    setSession(res.session ?? null);
    setValues({});
    onCompleted({ settings: res.settings, methodCapabilities: res.methodCapabilities });
    if (res.session?.status === "ENABLED" || stepId === "ACTIVATE") {
      onToast(`${methodLabel} is enabled.`, "success");
      onClose();
      return;
    }
    if (session.mode === "edit" || session.status === "EDITING") {
      onToast("Setup changes saved.", "success");
      return;
    }
    onToast("Setup progress saved.", "success");
  };

  const primaryLabel =
    session?.status === "READY_TO_ENABLE"
      ? `Enable ${methodLabel}`
      : session?.mode === "edit" || session?.status === "EDITING"
        ? currentStep?.id === "PROVIDE_CREDENTIALS" || currentStep?.id === "CONNECT_ADAPTER"
          ? "Save and verify"
          : "Save changes"
        : currentStep?.id === "PROVIDE_CREDENTIALS" || currentStep?.id === "CONNECT_ADAPTER"
          ? "Save and verify"
          : "Continue";

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={session?.mode === "edit" || session?.status === "EDITING" ? `Edit ${methodLabel} setup` : `Set up ${methodLabel}`}
      description={
        session?.mode === "edit" || session?.status === "EDITING"
          ? "Update credentials, payment contexts, or verification. The backend remains the source of truth for readiness."
          : "ServeOS connects directly to the payment network for this method. Complete each backend-required step before enabling it for guests."
      }
      titleId="payment-method-setup-wizard"
      maxWidthClass="max-w-2xl"
      busy={busy}
    >
      <ConfigModalContentGate open={open}>
        <div className="admin-payments-setup-wizard">
          {session ? (
            <ul className="admin-payments-setup-checklist">
              {session.checklist.map((item) => (
                <li key={item.id} className={item.done ? "is-done" : ""}>
                  <span aria-hidden>{item.done ? "✓" : "○"}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}

          {session ? (
            <ol className="admin-payments-setup-steps">
              {session.steps.map((step) => (
                <li
                  key={step.id}
                  className={`admin-payments-setup-step is-${step.status.toLowerCase()}${
                    step.id === currentStep?.id ? " is-current" : ""
                  }${session.mode === "edit" || session.status === "EDITING" ? " is-editable" : ""}`}
                >
                  <button
                    type="button"
                    className="admin-payments-setup-step-btn"
                    disabled={
                      busy ||
                      (!(session.mode === "edit" || session.status === "EDITING") &&
                        step.status === "LOCKED")
                    }
                    onClick={() => {
                      if (!(session.mode === "edit" || session.status === "EDITING")) return;
                      if (step.status === "LOCKED") return;
                      setSession({ ...session, currentStep: step.id });
                      setValues({});
                      setError(null);
                    }}
                  >
                    <strong>{step.label}</strong>
                    <span>{step.description}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}

          {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

          {currentStep?.fields?.length ? (
            <div className="admin-payments-setup-fields">
              <p className="admin-payments-setup-fields-title">{currentStep.label}</p>
              {currentStep.fields.map((field) => (
                <div key={field.key} className="admin-payments-setup-field">
                  <AdminLabel>
                    {field.label}
                    {field.required ? " *" : ""}
                    {field.configured ? " · Configured" : ""}
                  </AdminLabel>
                  {field.help ? <p className="admin-config-text-subtle text-xs mb-1">{field.help}</p> : null}
                  <FieldInput
                    field={field}
                    value={values[field.key]}
                    disabled={!canEdit || busy}
                    onChange={(next) => setValues((cur) => ({ ...cur, [field.key]: next }))}
                  />
                </div>
              ))}
            </div>
          ) : currentStep ? (
            <ProfileModalNote>
              {currentStep.description}
              {session?.status === "READY_TO_ENABLE" ? " You can enable this method when ready." : ""}
            </ProfileModalNote>
          ) : busy ? (
            <ProfileModalNote>Loading setup session…</ProfileModalNote>
          ) : null}

          <ProfileModalFooter
            cancelLabel="Close"
            confirmLabel={canEdit ? primaryLabel : "Done"}
            busy={busy}
            confirmDisabled={!canEdit || (!currentStep && session?.status !== "READY_TO_ENABLE")}
            onCancel={onClose}
            onConfirm={() => {
              if (!canEdit) {
                onClose();
                return;
              }
              void submitCurrent(session?.status === "READY_TO_ENABLE");
            }}
          />
        </div>
      </ConfigModalContentGate>
    </MenuPageModalShell>
  );
}
