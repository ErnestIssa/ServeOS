import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminBubbleDropdown } from "../AdminBubbleDropdown";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../AdminUi";
import { ProfileModalFooter, ProfileModalNote, ProfileModalShell } from "../profile/ProfileModalShell";
import { AdminSkeletonFormRows } from "../AdminSkeleton";
import { getMenuAdmin } from "../../api";
import { placeStaffOrder } from "./ordersApi";
import {
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  type OrderPriority,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus
} from "./ordersTypes";

export type CreateOrderLineDraft = {
  id: string;
  menuItemId: string;
  qty: string;
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
  menuItemId: "",
  qty: "1",
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

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isCreateOrderDirty(form: CreateOrderForm): boolean {
  if (form.customerName.trim() || form.customerPhone.trim() || form.customerEmail.trim()) return true;
  if (form.tableNumber.trim() || form.notes.trim()) return true;
  if (form.source !== "STAFF_CREATED" || form.initialStatus !== "CREATED") return true;
  return form.items.some((i) => i.menuItemId.trim() || i.modifiers.trim());
}

export function validateCreateOrderForm(form: CreateOrderForm): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (!form.customerName.trim()) errors.customerName = "Customer name is required.";
  const validItems = form.items.filter((i) => i.menuItemId.trim());
  if (!validItems.length) errors.items = "Add at least one menu item.";
  for (const item of validItems) {
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty < 1) errors.items = "Each item needs a quantity of at least 1.";
  }
  return errors;
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
      description={`A new order for ${customerName} will be placed.`}
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

type MenuItemOption = { value: string; label: string; priceCents: number };

export function CreateOrderModal({
  open,
  venueName,
  token,
  restaurantId,
  staffOptions,
  onClose,
  onCreated
}: {
  open: boolean;
  venueName: string;
  token?: string | null;
  restaurantId?: string | null;
  staffOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateOrderForm>(EMPTY_CREATE_ORDER_FORM);
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuLoadedOnce, setMenuLoadedOnce] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => validateCreateOrderForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isCreateOrderDirty(form);

  const menuItemMap = useMemo(
    () => Object.fromEntries(menuItems.map((m) => [m.value, m])),
    [menuItems]
  );

  const totalPreview = useMemo(() => {
    return form.items.reduce((sum, i) => {
      if (!i.menuItemId.trim()) return sum;
      const item = menuItemMap[i.menuItemId];
      if (!item) return sum;
      const qty = Math.max(1, Number(i.qty) || 1);
      return sum + (item.priceCents / 100) * qty;
    }, 0);
  }, [form.items, menuItemMap]);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_CREATE_ORDER_FORM);
      setTouched({});
      setSubmitAttempted(false);
      setDiscardOpen(false);
      setConfirmOpen(false);
      setShakeSubmit(false);
      setBusy(false);
      setSubmitError(null);
      setMenuLoadedOnce(false);
      return;
    }
    if (!token || !restaurantId) return;
    let cancelled = false;
    setMenuLoading(true);
    void (async () => {
      const menu = await getMenuAdmin(token, restaurantId);
      if (cancelled) return;
      setMenuLoading(false);
      setMenuLoadedOnce(true);
      if (!menu.ok) {
        setMenuItems([]);
        return;
      }
      const options: MenuItemOption[] = [];
      for (const cat of menu.categories ?? []) {
        for (const item of cat.items ?? []) {
          if (item.isActive) {
            options.push({
              value: item.id,
              label: item.name,
              priceCents: item.priceCents
            });
          }
        }
      }
      setMenuItems(options);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, restaurantId]);

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
      items: [...prev.items, { id: newLineId(), menuItemId: "", qty: "1", modifiers: "" }]
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

  const fieldClass = (key: string) => {
    const showError =
      key === "items"
        ? (submitAttempted || touched.items) && errors.items
        : (touched[key as keyof CreateOrderForm] || submitAttempted) && errors[key as keyof typeof errors];
    const showOk =
      key === "items"
        ? !errors.items && form.items.some((i) => i.menuItemId.trim())
        : (touched[key as keyof CreateOrderForm] || submitAttempted) &&
          !errors[key as keyof typeof errors] &&
          String(form[key as keyof CreateOrderForm] ?? "").trim();
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
    if (!token || !restaurantId) {
      setSubmitError("Sign in and select a venue first.");
      return;
    }
    setBusy(true);
    setSubmitError(null);
    const noteParts = [
      form.notes.trim(),
      form.customerName.trim() ? `Customer: ${form.customerName.trim()}` : "",
      form.customerPhone.trim() ? `Phone: ${form.customerPhone.trim()}` : "",
      form.customerEmail.trim() ? `Email: ${form.customerEmail.trim()}` : "",
      form.tableNumber.trim() ? `Table: ${form.tableNumber.trim()}` : "",
      form.assignedStaff ? `Staff: ${form.assignedStaff}` : "",
      `Priority: ${form.priority}`
    ].filter(Boolean);

    const res = await placeStaffOrder(token, {
      restaurantId,
      source: form.source,
      note: noteParts.join("\n"),
      lines: form.items
        .filter((i) => i.menuItemId.trim())
        .map((i) => ({
          menuItemId: i.menuItemId,
          quantity: Math.max(1, Number(i.qty) || 1)
        }))
    });
    setBusy(false);
    if (!res.ok) {
      setSubmitError(res.error ?? "Could not create order.");
      return;
    }
    setConfirmOpen(false);
    onCreated();
    finishClose();
  };

  const submitTone =
    submitAttempted && hasErrors
      ? "admin-staff-invite-submit--error"
      : !hasErrors && form.customerName.trim() && form.items.some((i) => i.menuItemId.trim())
        ? "admin-staff-invite-submit--ready"
        : "";

  const itemSummary = form.items
    .filter((i) => i.menuItemId.trim())
    .map((i) => menuItemMap[i.menuItemId]?.label ?? "Item")
    .join(", ");

  const menuItemDropdownOptions = menuItems.map((m) => ({
    value: m.value,
    label: `${m.label} (${(m.priceCents / 100).toLocaleString("sv-SE")} kr)`
  }));

  const staffDropdownOptions = [{ value: "", label: "Unassigned" }, ...staffOptions];

  return (
    <>
      <ProfileModalShell
        open={open}
        onClose={attemptClose}
        title="Create order"
        description="Select menu items and customer details. The order is placed when you confirm."
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
              options={staffDropdownOptions}
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
              Menu items <span className="admin-staff-field-required">*</span>
            </p>
            <AdminBtnSecondary onClick={addLine} disabled={menuLoading || menuItems.length === 0}>
              Add item
            </AdminBtnSecondary>
          </div>
          {menuLoading && !menuLoadedOnce ? <AdminSkeletonFormRows rows={2} /> : null}
          {!menuLoading && menuItems.length === 0 && menuLoadedOnce ? (
            <p className="mt-3 text-sm text-slate-500">No menu items available. Add items in Menu builder first.</p>
          ) : null}
          <ul className="admin-orders-create-items-list mt-3 space-y-3">
            {form.items.map((line, index) => (
              <li key={line.id} className="admin-orders-create-item-row">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminBubbleDropdown
                    label={`Item ${index + 1}`}
                    required
                    dropInline
                    value={line.menuItemId}
                    options={[{ value: "", label: "Select item" }, ...menuItemDropdownOptions]}
                    onChange={(v) => patchLine(line.id, "menuItemId", v)}
                  />
                  <AdminLabel>
                    <span className="admin-staff-field-label">Qty</span>
                    <AdminInput
                      className="admin-staff-premium-input"
                      inputMode="numeric"
                      value={line.qty}
                      onChange={(e) => patchLine(line.id, "qty", e.target.value)}
                    />
                  </AdminLabel>
                </div>
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

        {submitError ? (
          <p className="admin-staff-invite-form-alert mt-3" role="alert">
            {submitError}
          </p>
        ) : null}

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
            disabled={busy || menuItems.length === 0}
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
