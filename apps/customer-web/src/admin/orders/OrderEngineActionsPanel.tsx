import { useEffect, useState } from "react";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput } from "../AdminUi";
import { getMenuAdmin } from "../../api";
import {
  applyOrderEditApi,
  recordSourceInterpretationApi,
  type OrderEditOperation,
  type SourceInterpretation
} from "./ordersApi";
import type { AdminOrderVm } from "./ordersApiMappers";

type Props = {
  token: string;
  restaurantId: string;
  order: AdminOrderVm;
  onUpdated: () => void;
  onToast: (msg: string, tone?: "success" | "error") => void;
};

const INTERPRETATIONS: Array<{ value: SourceInterpretation; label: string }> = [
  { value: "STAFF_ASSISTED", label: "Mark staff-assisted" },
  { value: "HYBRID_STAFF_LINE_ADDITION", label: "Hybrid staff line add" },
  { value: "SOURCE_CORRECTION_LOGGED", label: "Log source correction" },
  { value: "PARTNER_REASSIGNED_INTERNAL", label: "Partner → internal" },
  { value: "CONVERTED_TO_RESERVATION", label: "Converted to reservation" }
];

export function OrderEngineActionsPanel({ token, restaurantId, order, onUpdated, onToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(order.notes ?? "");
  const [allergyNote, setAllergyNote] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [interpretation, setInterpretation] = useState<SourceInterpretation>("STAFF_ASSISTED");
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string }>>([]);
  const [addItemId, setAddItemId] = useState("");

  useEffect(() => {
    void (async () => {
      const menu = await getMenuAdmin(token, restaurantId);
      if (!menu.ok || !menu.categories) return;
      const items = menu.categories.flatMap((c) => c.items.filter((i) => i.isActive).map((i) => ({ id: i.id, name: i.name })));
      setMenuItems(items);
      if (items[0]) setAddItemId(items[0].id);
    })();
  }, [token, restaurantId]);

  const raw = order.apiStatus ?? order.status;
  const canEditLines =
    ["CREATED", "PENDING_PAYMENT", "PAID", "ACCEPTED"].includes(raw) && order.paymentStatus !== "PAID";

  async function runEdit(operation: OrderEditOperation, payload: Record<string, unknown>, reason?: string) {
    setBusy(true);
    const res = await applyOrderEditApi(token, order.id, {
      expectedVersion: order.version,
      operation,
      payload,
      reason,
      requestSource: "UI"
    });
    setBusy(false);
    if (!res.ok) {
      onToast(res.error ?? "Edit failed", "error");
      return;
    }
    const extra =
      res.pricing?.requiresAdditionalCharge
        ? " Additional payment required."
        : res.pricing?.requiresRefundDelta
          ? " Refund delta recorded."
          : "";
    onToast(`Order updated.${extra}`, "success");
    onUpdated();
  }

  async function runInterpretation() {
    setBusy(true);
    const res = await recordSourceInterpretationApi(token, order.id, {
      interpretation,
      note: correctionReason.trim() || undefined
    });
    setBusy(false);
    if (!res.ok) {
      onToast(res.error ?? "Could not record interpretation", "error");
      return;
    }
    onToast("Source interpretation recorded.", "success");
    onUpdated();
  }

  return (
    <section className="admin-orders-drawer-section admin-orders-engine-actions">
      <h3 className="admin-orders-drawer-section-title">Order actions</h3>
      <p className="admin-orders-drawer-muted text-xs">
        Version {order.version} · Source {order.source.replace(/_/g, " ")}
        {canEditLines ? " · Line edits allowed" : " · Line edits restricted"}
      </p>

      <div className="mt-3 grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Order note</span>
          <AdminInput value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          <AdminBtnSecondary
            disabled={busy || note === (order.notes ?? "")}
            onClick={() => void runEdit("UPDATE_NOTE", { note })}
          >
            Save note
          </AdminBtnSecondary>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Allergy note</span>
          <AdminInput
            placeholder="e.g. peanut allergy"
            value={allergyNote}
            onChange={(e) => setAllergyNote(e.target.value)}
            disabled={busy}
          />
          <AdminBtnSecondary
            disabled={busy || !allergyNote.trim()}
            onClick={() => void runEdit("ADD_ALLERGY_NOTE", { allergyNote: allergyNote.trim() })}
          >
            Append allergy tag
          </AdminBtnSecondary>
        </label>

        {canEditLines && menuItems.length > 0 ? (
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Add menu item</span>
            <select
              className="admin-input rounded-lg border px-3 py-2 text-sm"
              value={addItemId}
              onChange={(e) => setAddItemId(e.target.value)}
              disabled={busy}
            >
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <AdminBtnPrimary
              disabled={busy || !addItemId}
              onClick={() =>
                void runEdit("ADD_ITEM", { menuItemId: addItemId, quantity: 1 }, "Staff added item via admin")
              }
            >
              Add item
            </AdminBtnPrimary>
          </div>
        ) : null}

        {order.items.length > 0 && canEditLines ? (
          <AdminBtnSecondary
            disabled={busy || order.items.length <= 1}
            onClick={() => {
              const last = order.items[order.items.length - 1];
              if (!last) return;
              void runEdit("REMOVE_ITEM", { lineItemId: last.id }, "Staff removed line");
            }}
          >
            Remove last line
          </AdminBtnSecondary>
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Staff correction</span>
          <AdminInput
            placeholder="Reason (required)"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            disabled={busy}
          />
          <AdminBtnSecondary
            disabled={busy || !correctionReason.trim()}
            onClick={() =>
              void runEdit("STAFF_CORRECTION", { correctionNote: correctionReason.trim() }, correctionReason.trim())
            }
          >
            Log staff correction
          </AdminBtnSecondary>
        </label>

        <div className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Source lifecycle</span>
          <select
            className="admin-input rounded-lg border px-3 py-2 text-sm"
            value={interpretation}
            onChange={(e) => setInterpretation(e.target.value as SourceInterpretation)}
            disabled={busy}
          >
            {INTERPRETATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <AdminBtnPrimary disabled={busy} onClick={() => void runInterpretation()}>
            Record interpretation
          </AdminBtnPrimary>
        </div>
      </div>
    </section>
  );
}
