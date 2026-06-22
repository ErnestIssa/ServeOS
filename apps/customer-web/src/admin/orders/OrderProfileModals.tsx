import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminBubbleDropdown } from "../AdminBubbleDropdown";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../AdminUi";
import { ProfileModalFooter, ProfileModalNote, ProfileModalShell } from "../profile/ProfileModalShell";
import {
  MOCK_STAFF_OPTIONS,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  type MockOrder,
  type OrderLineItem,
  type OrderPriority,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus
} from "./ordersMockData";

export type CreateOrderLineDraft = {
  id: string;
  name: string;
  qty: string;
  unitPrice: string;
  modifiers: string;
};

export type CreateOrderForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  source: OrderSource;
  tableNumber: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  assignedStaff: string;
  priority: OrderPriority;
  initialStatus: OrderStatus;
  notes: string;
  items: CreateOrderLineDraft[];
};

const EMPTY_LINE: CreateOrderLineDraft = {
  id: "line-1",
  name: "",
  qty: "1",
  unitPrice: "",
  modifiers: ""
};

export const EMPTY_CREATE_ORDER_FORM: CreateOrderForm = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  source: "STAFF_CREATED",
  tableNumber: "",
  paymentMethod: "Card",
  paymentStatus: "PENDING",
  assignedStaff: "",
  priority: "normal",
  initialStatus: "CREATED",
  notes: "",
  items: [{ ...EMPTY_LINE }]
};

const SOURCE_OPTIONS = Object.entries(ORDER_SOURCE_LABELS).map(([value, label]) => ({
  value,
  label
}));

const PAYMENT_METHOD_OPTIONS = [
  { value: "Card", label: "Card" },
  { value: "Cash", label: "Cash" },
  { value: "Invoice", label: "Invoice" },
  { value: "Pay at pickup", label: "Pay at pickup" },
  { value: "Partner", label: "Delivery partner" }
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" }
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "rush", label: "Rush" }
];

const STATUS_OPTIONS = [
  { value: "CREATED", label: "Created" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DRAFT", label: "Draft (save for later)" }
];

const STAFF_OPTIONS = [
  { value: "", label: "Unassigned" },
  ...MOCK_STAFF_OPTIONS.filter((s) => s !== "All staff").map((s) => ({
    value: s,
    label: s
  }))
];

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isCreateOrderDirty(form: CreateOrderForm): boolean {
  if (form.customerName.trim() || form.customerPhone.trim() || form.customerEmail.trim()) return true;
  if (form.tableNumber.trim() || form.notes.trim()) return true;
  if (form.source !== "STAFF_CREATED" || form.initialStatus !== "CREATED") return true;
  return form.items.some((i) => i.name.trim() || i.unitPrice.trim() || i.modifiers.trim());
}

export function validateCreateOrderForm(form: CreateOrderForm): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (!form.customerName.trim()) errors.customerName = "Customer name is required.";
  const validItems = form.items.filter((i) => i.name.trim());
  if (!validItems.length) errors.items = "Add at least one menu item.";
  for (const item of validItems) {
    const qty = Number(item.qty);
    const price = Number(item.unitPrice);
    if (!Number.isFinite(qty) || qty < 1) errors.items = "Each item needs a quantity of at least 1.";
    if (!Number.isFinite(price) || price < 0) errors.items = "Each item needs a valid price.";
  }
  return errors;
}

export function buildMockOrderFromForm(form: CreateOrderForm, seq: number): MockOrder {
  const items: OrderLineItem[] = form.items
    .filter((i) => i.name.trim())
    .map((i, idx) => ({
      id: `new-li-${idx}`,
      name: i.name.trim(),
      qty: Math.max(1, Number(i.qty) || 1),
      unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      modifiers: i.modifiers.trim() ? i.modifiers.split(",").map((m) => m.trim()) : undefined
    }));
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const now = new Date().toISOString();
  const kitchenStatus =
    form.initialStatus === "ACCEPTED" ? "ACCEPTED" : form.initialStatus === "DRAFT" ? "NEW" : "NEW";

  return {
    id: `ord-new-${Date.now()}`,
    displayNumber: `#${seq}`,
    status: form.initialStatus,
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim() || undefined,
    customerEmail: form.customerEmail.trim() || undefined,
    source: form.source,
    items,
    itemCount,
    itemsSummary: items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(", "),
    total,
    createdAt: now,
    assignedStaff: form.assignedStaff || undefined,
    tableNumber: form.tableNumber.trim() || undefined,
    paymentStatus: form.paymentStatus,
    paymentMethod: form.paymentMethod,
    waitingMinutes: 0,
    kitchenStatus,
    priority: form.priority,
    notes: form.notes.trim() || undefined,
    timeline: [{ at: now, label: ORDER_STATUS_LABELS[form.initialStatus], actor: "Staff" }]
  };
}

export function CreateOrderDiscardModal({
  open,
  onStay,
  onDiscard
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={onStay}
      title="Discard new order?"
      description="You started creating an order. Closing now will clear what you entered."
      titleId="order-create-discard-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
    >
      <ProfileModalNote>
        <strong>Keep editing</strong> returns you to the form with your entries intact.
        <br />
        <strong>Discard</strong> closes the form and clears all fields.
      </ProfileModalNote>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={onStay} className="admin-profile-modal-btn admin-profile-modal-btn--primary w-full">
          Keep editing
        </button>
        <button type="button" onClick={onDiscard} className="admin-profile-modal-btn admin-profile-modal-btn--danger w-full">
          Discard order
        </button>
      </div>
    </ProfileModalShell>
  );
}

export function CreateOrderConfirmModal({
  open,
  customerName,
  itemSummary,
  totalLabel,
  sourceLabel,
  statusLabel,
  busy,
  onCancel,
  onConfirm
}: {
  open: boolean;
  customerName: string;
  itemSummary: string;
  totalLabel: string;
  sourceLabel: string;
  statusLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create this order?"
      description={`A new order for ${customerName} will be added to the board.`}
      titleId="order-create-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        Source: <strong>{sourceLabel}</strong>
        <br />
        Status: <strong>{statusLabel}</strong>
        <br />
        Items: <strong>{itemSummary}</strong>
        <br />
        Total: <strong>{totalLabel}</strong>
      </ProfileModalNote>
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create order"
        cancelLabel="Go back"
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function OrderActionConfirmModal({
  open,
  title,
  description,
  note,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  note?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      description={description}
      titleId="order-action-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      {note ? <ProfileModalNote>{note}</ProfileModalNote> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        danger={danger}
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function CreateOrderModal({
  open,
  venueName,
  onClose,
  onCreated
}: {
  open: boolean;
  venueName: string;
  onClose: () => void;
  onCreated: (order: MockOrder) => void;
}) {
  const [form, setForm] = useState<CreateOrderForm>(EMPTY_CREATE_ORDER_FORM);
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [busy, setBusy] = useState(false);

  const errors = useMemo(() => validateCreateOrderForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isCreateOrderDirty(form);

  const totalPreview = useMemo(() => {
    return form.items.reduce((sum, i) => {
      if (!i.name.trim()) return sum;
      const qty = Math.max(1, Number(i.qty) || 1);
      const price = Math.max(0, Number(i.unitPrice) || 0);
      return sum + qty * price;
    }, 0);
  }, [form.items]);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_CREATE_ORDER_FORM);
      setTouched({});
      setSubmitAttempted(false);
      setDiscardOpen(false);
      setConfirmOpen(false);
      setShakeSubmit(false);
      setBusy(false);
    }
  }, [open]);

  const patch = <K extends keyof CreateOrderForm>(key: K, value: CreateOrderForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const patchLine = (id: string, key: keyof CreateOrderLineDraft, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line) => (line.id === id ? { ...line, [key]: value } : line))
    }));
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: newLineId(), name: "", qty: "1", unitPrice: "", modifiers: "" }]
    }));
  };

  const removeLine = (id: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((l) => l.id !== id) : prev.items
    }));
  };

  const attemptClose = () => {
    if (busy) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const finishClose = () => {
    setDiscardOpen(false);
    setForm(EMPTY_CREATE_ORDER_FORM);
    setTouched({});
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: string, lineId?: string) => {
    const showError =
      key === "items"
        ? (submitAttempted || touched.items) && errors.items
        : (touched[key as keyof CreateOrderForm] || submitAttempted) && errors[key as keyof typeof errors];
    const showOk =
      key === "items"
        ? !errors.items && form.items.some((i) => i.name.trim())
        : (touched[key as keyof CreateOrderForm] || submitAttempted) &&
          !errors[key as keyof typeof errors] &&
          String(form[key as keyof CreateOrderForm] ?? "").trim();
    if (lineId && !showError) return "";
    return [showError ? "admin-staff-field--error" : "", showOk ? "admin-staff-field--ok" : ""].filter(Boolean).join(" ");
  };

  const handleCreate = () => {
    setSubmitAttempted(true);
    if (Object.keys(validateCreateOrderForm(form)).length > 0) {
      setShakeSubmit(true);
      window.setTimeout(() => setShakeSubmit(false), 520);
      return;
    }
    setConfirmOpen(true);
  };

  const confirmCreate = async () => {
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 480));
    const order = buildMockOrderFromForm(form, 1100 + Math.floor(Math.random() * 900));
    setBusy(false);
    setConfirmOpen(false);
    onCreated(order);
    finishClose();
  };

  const submitTone =
    submitAttempted && hasErrors
      ? "admin-staff-invite-submit--error"
      : !hasErrors && form.customerName.trim() && form.items.some((i) => i.name.trim())
        ? "admin-staff-invite-submit--ready"
        : "";

  const itemSummary = form.items
    .filter((i) => i.name.trim())
    .map((i) => i.name.trim())
    .join(", ");

  return (
    <>
      <ProfileModalShell
        open={open}
        onClose={attemptClose}
        title="Create order"
        description="Enter customer, items, and payment details. The order appears on the board once you confirm."
        titleId="create-order-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={busy}
      >
        <div className="admin-staff-invite-form">
          <div className="admin-staff-invite-form__identity">
            <AdminLabel className={fieldClass("customerName")}>
              <span className="admin-staff-field-label">
                Customer name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input"
                placeholder="Guest name or company"
                value={form.customerName}
                onChange={(e) => patch("customerName", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, customerName: true }))}
              />
              {(touched.customerName || submitAttempted) && errors.customerName ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.customerName}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel>
              <span className="admin-staff-field-label">Phone (optional)</span>
              <AdminInput
                className="admin-staff-premium-input"
                type="tel"
                placeholder="+46 …"
                value={form.customerPhone}
                onChange={(e) => patch("customerPhone", e.target.value)}
              />
            </AdminLabel>

            <AdminLabel>
              <span className="admin-staff-field-label">Email (optional)</span>
              <AdminInput
                className="admin-staff-premium-input"
                type="email"
                placeholder="name@example.com"
                value={form.customerEmail}
                onChange={(e) => patch("customerEmail", e.target.value)}
              />
            </AdminLabel>
          </div>

          <div className="admin-staff-invite-form__assignments">
            <div className="admin-staff-invite-venue-note">
              <p className="admin-staff-invite-venue-note__label">Venue</p>
              <p className="admin-staff-invite-venue-note__value">{venueName.trim() || "Your restaurant"}</p>
              <p className="admin-staff-invite-venue-note__hint">Order is created for the active venue.</p>
            </div>

            <AdminBubbleDropdown
              label="Order source"
              required
              dropInline
              value={form.source}
              options={SOURCE_OPTIONS}
              onChange={(v) => patch("source", v as OrderSource)}
            />

            <AdminBubbleDropdown
              label="Initial status"
              required
              dropInline
              value={form.initialStatus}
              options={STATUS_OPTIONS}
              onChange={(v) => patch("initialStatus", v as OrderStatus)}
            />

            <AdminLabel>
              <span className="admin-staff-field-label">Table (optional)</span>
              <AdminInput
                className="admin-staff-premium-input"
                placeholder="e.g. T12, Bar 2"
                value={form.tableNumber}
                onChange={(e) => patch("tableNumber", e.target.value)}
              />
            </AdminLabel>

            <AdminBubbleDropdown
              label="Assigned staff"
              dropInline
              value={form.assignedStaff}
              options={STAFF_OPTIONS}
              onChange={(v) => patch("assignedStaff", v)}
            />

            <AdminBubbleDropdown
              label="Priority"
              dropInline
              value={form.priority}
              options={PRIORITY_OPTIONS}
              onChange={(v) => patch("priority", v as OrderPriority)}
            />

            <AdminBubbleDropdown
              label="Payment method"
              dropInline
              value={form.paymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
              onChange={(v) => patch("paymentMethod", v)}
            />

            <AdminBubbleDropdown
              label="Payment status"
              dropInline
              value={form.paymentStatus}
              options={PAYMENT_STATUS_OPTIONS}
              onChange={(v) => patch("paymentStatus", v as PaymentStatus)}
            />
          </div>
        </div>

        <div className="admin-orders-create-items mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="admin-staff-field-label">
              Items <span className="admin-staff-field-required">*</span>
            </p>
            <AdminBtnSecondary onClick={addLine}>Add item</AdminBtnSecondary>
          </div>
          <ul className="admin-orders-create-items-list mt-3 space-y-3">
            {form.items.map((line, index) => (
              <li key={line.id} className="admin-orders-create-item-row">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminLabel>
                    <span className="admin-staff-field-label">Item {index + 1}</span>
                    <AdminInput
                      className="admin-staff-premium-input"
                      placeholder="Menu item name"
                      value={line.name}
                      onChange={(e) => patchLine(line.id, "name", e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, items: true }))}
                    />
                  </AdminLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <AdminLabel>
                      <span className="admin-staff-field-label">Qty</span>
                      <AdminInput
                        className="admin-staff-premium-input"
                        inputMode="numeric"
                        value={line.qty}
                        onChange={(e) => patchLine(line.id, "qty", e.target.value)}
                      />
                    </AdminLabel>
                    <AdminLabel>
                      <span className="admin-staff-field-label">Price</span>
                      <AdminInput
                        className="admin-staff-premium-input"
                        inputMode="decimal"
                        placeholder="kr"
                        value={line.unitPrice}
                        onChange={(e) => patchLine(line.id, "unitPrice", e.target.value)}
                      />
                    </AdminLabel>
                  </div>
                </div>
                <AdminLabel className="mt-2">
                  <span className="admin-staff-field-label">Modifiers (optional)</span>
                  <AdminInput
                    className="admin-staff-premium-input"
                    placeholder="Comma-separated, e.g. No onions, Extra cheese"
                    value={line.modifiers}
                    onChange={(e) => patchLine(line.id, "modifiers", e.target.value)}
                  />
                </AdminLabel>
                {form.items.length > 1 ? (
                  <button type="button" className="admin-orders-create-remove-line" onClick={() => removeLine(line.id)}>
                    Remove item
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {submitAttempted && errors.items ? (
            <span className="admin-staff-field-error mt-2 block" role="alert">
              {errors.items}
            </span>
          ) : null}
        </div>

        <AdminLabel className="mt-5 block">
          <span className="admin-staff-field-label">Order notes (optional)</span>
          <AdminInput
            className="admin-staff-premium-input"
            placeholder="Allergies, pickup time, special instructions…"
            value={form.notes}
            onChange={(e) => patch("notes", e.target.value)}
          />
        </AdminLabel>

        <p className="admin-orders-create-total mt-4 text-sm font-bold admin-orders-text">
          Order total preview: {totalPreview.toLocaleString("sv-SE")} kr
        </p>

        {submitAttempted && hasErrors ? (
          <p className="admin-staff-invite-form-alert" role="alert">
            Complete the required fields before creating the order.
          </p>
        ) : null}

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={attemptClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className={`admin-staff-invite-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
          >
            {busy ? "Creating…" : "Create order"}
          </button>
        </div>
      </ProfileModalShell>

      <CreateOrderDiscardModal open={discardOpen} onStay={() => setDiscardOpen(false)} onDiscard={finishClose} />

      <CreateOrderConfirmModal
        open={confirmOpen}
        customerName={form.customerName.trim()}
        itemSummary={itemSummary || "—"}
        totalLabel={`${totalPreview.toLocaleString("sv-SE")} kr`}
        sourceLabel={ORDER_SOURCE_LABELS[form.source]}
        statusLabel={ORDER_STATUS_LABELS[form.initialStatus]}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirmCreate()}
      />
    </>
  );
}
