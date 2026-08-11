import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { VenuePaymentSettings } from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { renderPaymentPieSliceLabel } from "./paymentPieLabels";
import {
  PaymentChipGroup,
  PaymentExpandSelect,
  PaymentSourceChip,
  PaymentSwitch,
  type PaymentSelectOption
} from "./paymentsFormControls";
import { MoneyTile, PaySection } from "./paymentsShared";
import { formatSekFromCents, PAY_AT_VENUE_TIMING_OPTIONS } from "./paymentsUiHelpers";

type Props = {
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onPatch: (patch: Partial<VenuePaymentSettings>) => void;
};

type PendingConfirm = {
  title: string;
  copy: string;
  confirmLabel: string;
  danger?: boolean;
  apply: () => void;
};

type CoverageSlice = {
  key: string;
  label: string;
  short: string;
  value: number;
  fill: string;
  statusLabel: string;
};

type DomainBar = {
  key: string;
  label: string;
  shortLabel: string;
  score: number;
  fill: string;
};

const MODE_OPTIONS: PaymentSelectOption[] = [
  {
    value: "PAY_AT_VENUE",
    label: "Pay at venue",
    hint: "Guests settle in person — cash, terminal, Swish, etc."
  },
  {
    value: "PREPAY",
    label: "Pay in app (prepay)",
    hint: "Guests pay in the app before preparation when required."
  },
  {
    value: "HYBRID",
    label: "Hybrid",
    hint: "Mix of prepay and pay-at-venue depending on channel and rules."
  }
];

const TIMING_OPTIONS: PaymentSelectOption[] = PAY_AT_VENUE_TIMING_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
  hint:
    opt.value === "before_served"
      ? "Collect before food leaves the pass."
      : opt.value === "when_ready"
        ? "Collect when the order is marked ready."
        : opt.value === "when_bill_requested"
          ? "Collect when guests ask for the bill."
          : "Collect after the visit is completed."
}));

const CASH_TIPS_OPTIONS: PaymentSelectOption[] = [
  { value: "track_manually", label: "Track manually", hint: "Staff record cash tips in ops tools." },
  { value: "ignore", label: "Ignore", hint: "Cash tips are not tracked in ServeOS." }
];

const TIP_PRESETS = [10, 12, 15, 18, 20, 25] as const;

const CHANNELS: Array<{ key: keyof NonNullable<VenuePaymentSettings["payAtVenue"]>["channels"]; label: string }> = [
  { key: "qrOrders", label: "QR orders" },
  { key: "walkIns", label: "Walk-ins" },
  { key: "staffCreated", label: "Staff-created" },
  { key: "reservations", label: "Reservations" },
  { key: "delivery", label: "Delivery" }
];

const SETTLEMENTS: Array<{
  key: keyof NonNullable<VenuePaymentSettings["payAtVenue"]>["settlementMethods"];
  label: string;
}> = [
  { key: "cash", label: "Cash" },
  { key: "cardTerminal", label: "Card terminal" },
  { key: "swish", label: "Swish" },
  { key: "other", label: "Other" }
];

const MODE_LABELS: Record<VenuePaymentSettings["rules"]["defaultPaymentMode"], string> = {
  PAY_AT_VENUE: "Pay at venue",
  PREPAY: "Pay in app",
  HYBRID: "Hybrid"
};

function scoreDomain(on: boolean, weight = 1) {
  return on ? weight : 0;
}

function CoverageTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: CoverageSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="admin-payments-health-tooltip">
      <p className="admin-payments-health-tooltip-title">{row.label}</p>
      <p className="admin-payments-health-tooltip-status" style={{ color: row.fill }}>
        {row.statusLabel}
      </p>
    </div>
  );
}

function DomainBarTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: DomainBar }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="admin-payments-health-tooltip">
      <p className="admin-payments-health-tooltip-title">{row.label}</p>
      <p className="admin-payments-health-tooltip-status" style={{ color: row.fill }}>
        {row.score}% configured
      </p>
    </div>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function PaymentsRulesTab({ settings, canEdit, onPatch }: Props) {
  const payAtVenue = settings.payAtVenue ?? {
    enabled: true,
    timing: "when_bill_requested" as const,
    channels: { qrOrders: true, walkIns: true, staffCreated: true, reservations: true, delivery: false },
    settlementMethods: { cash: true, cardTerminal: true, swish: true, other: false }
  };
  const qr = settings.qrPolicy ?? {
    defaultPaymentMode: "PAY_AT_VENUE" as const,
    allowSwitchToApp: true,
    requirePaymentBeforePrep: false,
    allowUnpaidOrders: true,
    autoCloseUnpaidHours: 4,
    requireStaffConfirmation: false
  };
  const splits = settings.splits ?? {
    enabled: true,
    maxSplits: 10,
    allowCustomerSelfSplit: true,
    allowStaffSplit: true,
    allowEqualSplit: true,
    allowItemBasedSplit: true,
    allowCustomAmount: true
  };
  const tips = settings.tips ?? {
    enabled: true,
    suggestedPercents: [10, 15, 20],
    customTip: true,
    tipBeforePayment: true,
    tipAfterPayment: true,
    cashTipsMode: "track_manually" as const
  };
  const failed = settings.failedPayment ?? {
    remainUnpaid: true,
    allowRetry: true,
    blockKitchen: true,
    allowStaffAcceptUnpaid: false
  };
  const refundLimits = settings.refundLimits ?? {
    staffMaxCents: 20_000,
    managerMaxCents: 500_000,
    ownerUnlimited: true
  };

  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [autoCloseDraft, setAutoCloseDraft] = useState(String(qr.autoCloseUnpaidHours ?? ""));
  const [maxSplitsDraft, setMaxSplitsDraft] = useState(String(splits.maxSplits));
  const [staffMaxDraft, setStaffMaxDraft] = useState(String(refundLimits.staffMaxCents));
  const [managerMaxDraft, setManagerMaxDraft] = useState(String(refundLimits.managerMaxCents));

  useEffect(() => {
    setAutoCloseDraft(String(qr.autoCloseUnpaidHours ?? ""));
  }, [qr.autoCloseUnpaidHours]);
  useEffect(() => {
    setMaxSplitsDraft(String(splits.maxSplits));
  }, [splits.maxSplits]);
  useEffect(() => {
    setStaffMaxDraft(String(refundLimits.staffMaxCents));
  }, [refundLimits.staffMaxCents]);
  useEffect(() => {
    setManagerMaxDraft(String(refundLimits.managerMaxCents));
  }, [refundLimits.managerMaxCents]);

  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), 3800);
    return () => window.clearTimeout(t);
  }, [status]);

  const requestConfirm = (next: PendingConfirm) => {
    if (!canEdit) return;
    setPending(next);
  };

  const applyConfirmed = () => {
    if (!pending) return;
    pending.apply();
    setPending(null);
  };

  const patchWithStatus = (patch: Partial<VenuePaymentSettings>, message: string) => {
    onPatch(patch);
    setStatus(message);
  };

  const channelCount = CHANNELS.filter((c) => payAtVenue.channels[c.key]).length;
  const settlementCount = SETTLEMENTS.filter((s) => payAtVenue.settlementMethods[s.key]).length;
  const tipCount = tips.suggestedPercents.length;

  const domainBars: DomainBar[] = useMemo(() => {
    const channelScore = Math.round((channelCount / CHANNELS.length) * 100);
    const settlementScore = Math.round((settlementCount / SETTLEMENTS.length) * 100);
    const tipScore = tips.enabled ? Math.min(100, 40 + tipCount * 12 + (tips.customTip ? 20 : 0)) : 0;
    const splitScore = splits.enabled
      ? Math.min(
          100,
          30 +
            scoreDomain(splits.allowEqualSplit, 14) +
            scoreDomain(splits.allowItemBasedSplit, 14) +
            scoreDomain(splits.allowCustomAmount, 14) +
            scoreDomain(splits.allowCustomerSelfSplit, 14) +
            scoreDomain(splits.allowStaffSplit, 14)
        )
      : 0;
    const qrScore = Math.min(
      100,
      25 +
        scoreDomain(qr.allowSwitchToApp, 15) +
        scoreDomain(qr.requirePaymentBeforePrep, 15) +
        scoreDomain(qr.allowUnpaidOrders, 15) +
        scoreDomain(qr.requireStaffConfirmation, 15) +
        scoreDomain(qr.autoCloseUnpaidHours != null, 15)
    );
    const failedScore = Math.min(
      100,
      scoreDomain(failed.remainUnpaid, 25) +
        scoreDomain(failed.allowRetry, 25) +
        scoreDomain(failed.blockKitchen, 25) +
        scoreDomain(failed.allowStaffAcceptUnpaid, 25)
    );
    const refundScore = Math.min(
      100,
      40 +
        scoreDomain(refundLimits.staffMaxCents > 0, 20) +
        scoreDomain(refundLimits.managerMaxCents > 0, 20) +
        scoreDomain(refundLimits.ownerUnlimited, 20)
    );

    return [
      { key: "mode", label: "Default mode", shortLabel: "Mode", score: 100, fill: "#2563eb" },
      {
        key: "venue",
        label: "Pay at venue",
        shortLabel: "Venue",
        score: payAtVenue.enabled ? Math.round((channelScore + settlementScore) / 2) : 0,
        fill: "#0ea5e9"
      },
      { key: "qr", label: "QR policy", shortLabel: "QR", score: qrScore, fill: "#8b5cf6" },
      { key: "splits", label: "Splits", shortLabel: "Split", score: splitScore, fill: "#16a34a" },
      { key: "tips", label: "Tips", shortLabel: "Tips", score: tipScore, fill: "#d97706" },
      { key: "failed", label: "Failed payments", shortLabel: "Fail", score: failedScore, fill: "#dc2626" },
      { key: "refunds", label: "Refund limits", shortLabel: "Refund", score: refundScore, fill: "#64748b" }
    ];
  }, [
    channelCount,
    settlementCount,
    tipCount,
    tips.enabled,
    tips.customTip,
    splits,
    qr,
    failed,
    refundLimits,
    payAtVenue.enabled
  ]);

  const coverageSlices: CoverageSlice[] = useMemo(() => {
    const ready = domainBars.filter((d) => d.score >= 70).length;
    const partial = domainBars.filter((d) => d.score > 0 && d.score < 70).length;
    const off = domainBars.filter((d) => d.score === 0).length;
    return [
      {
        key: "ready",
        label: "Ready",
        short: "OK",
        value: ready,
        fill: "#16a34a",
        statusLabel: `${ready} domains ready`
      },
      {
        key: "partial",
        label: "Needs review",
        short: "Rev",
        value: partial,
        fill: "#d97706",
        statusLabel: `${partial} domains partial`
      },
      {
        key: "off",
        label: "Off / empty",
        short: "Off",
        value: off,
        fill: "#94a3b8",
        statusLabel: `${off} domains off`
      }
    ].filter((s) => s.value > 0);
  }, [domainBars]);

  const overallReady = domainBars.filter((d) => d.score >= 70).length;
  const timingLabel =
    PAY_AT_VENUE_TIMING_OPTIONS.find((o) => o.value === payAtVenue.timing)?.label ?? payAtVenue.timing;

  return (
    <div className="admin-payments-tab-stack admin-payments-rules-page">
      <div className="admin-payments-methods-board-head">
        <div className="min-w-0">
          <h2 className="admin-payments-methods-board-title">Payment rules</h2>
          <p className="admin-payments-methods-board-desc">
            Guest checkout policy for this venue — default mode, pay-at-venue timing, QR, splits, tips,
            failed-payment behavior, and refund limits. Changes stay local until you save.
          </p>
        </div>
        <span
          className={`admin-payments-health-issue-badge ${
            overallReady >= 5 ? "is-ok" : overallReady >= 3 ? "is-warning" : "is-muted"
          }`}
        >
          {overallReady}/{domainBars.length} ready
        </span>
      </div>

      {status ? (
        <p className="admin-payments-source-status" role="status">
          {status}
        </p>
      ) : null}

      <div className="admin-payments-overview-grid">
        <PaySection title="Policy snapshot" borderless>
          <div className="admin-payments-rules-snapshot">
            <div className="admin-payments-today-metrics admin-payments-rules-metrics">
              <button
                type="button"
                className="admin-payments-today-metric"
                onClick={() => scrollToSection("rules-default-mode")}
              >
                <span className="admin-payments-today-metric-label">Default mode</span>
                <span className="admin-payments-today-metric-value">
                  {MODE_LABELS[settings.rules.defaultPaymentMode]}
                </span>
                <span className="admin-payments-today-metric-hint">Order + QR default</span>
              </button>
              <button
                type="button"
                className="admin-payments-today-metric"
                onClick={() => scrollToSection("rules-pay-at-venue")}
              >
                <span className="admin-payments-today-metric-label">Pay at venue</span>
                <span className="admin-payments-today-metric-value">
                  {payAtVenue.enabled ? timingLabel : "Off"}
                </span>
                <span className="admin-payments-today-metric-hint">
                  {channelCount} channels · {settlementCount} settlements
                </span>
              </button>
              <button
                type="button"
                className="admin-payments-today-metric"
                onClick={() => scrollToSection("rules-splits")}
              >
                <span className="admin-payments-today-metric-label">Splits</span>
                <span className="admin-payments-today-metric-value">
                  {splits.enabled ? `Max ${splits.maxSplits}` : "Off"}
                </span>
                <span className="admin-payments-today-metric-hint">
                  {splits.enabled ? "Guest & staff options" : "Disabled"}
                </span>
              </button>
              <button
                type="button"
                className="admin-payments-today-metric"
                onClick={() => scrollToSection("rules-tips")}
              >
                <span className="admin-payments-today-metric-label">Tips</span>
                <span className="admin-payments-today-metric-value">
                  {tips.enabled ? `${tipCount} presets` : "Off"}
                </span>
                <span className="admin-payments-today-metric-hint">
                  {tips.enabled ? tips.suggestedPercents.map((n) => `${n}%`).join(" · ") || "No presets" : "Disabled"}
                </span>
              </button>
              <button
                type="button"
                className="admin-payments-today-metric"
                onClick={() => scrollToSection("rules-refunds")}
              >
                <span className="admin-payments-today-metric-label">Staff refund cap</span>
                <span className="admin-payments-today-metric-value">
                  {formatSekFromCents(refundLimits.staffMaxCents)}
                </span>
                <span className="admin-payments-today-metric-hint">
                  Manager {formatSekFromCents(refundLimits.managerMaxCents)}
                </span>
              </button>
              <button
                type="button"
                className="admin-payments-today-metric"
                onClick={() => scrollToSection("rules-failed")}
              >
                <span className="admin-payments-today-metric-label">Failed payments</span>
                <span className="admin-payments-today-metric-value">
                  {failed.blockKitchen ? "Block kitchen" : "Kitchen open"}
                </span>
                <span className="admin-payments-today-metric-hint">
                  {failed.allowRetry ? "Retry allowed" : "No retry"}
                </span>
              </button>
            </div>
          </div>
        </PaySection>

        <PaySection title="Rules coverage" borderless>
          <div className="admin-payments-rules-coverage">
            <div className="admin-payments-health-pie">
              <div className="admin-payments-health-pie-chart admin-payments-health-pie-chart--readonly">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={coverageSlices}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      label={renderPaymentPieSliceLabel}
                      labelLine={false}
                    >
                      {coverageSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CoverageTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="admin-payments-health-metrics">
                {coverageSlices.map((slice) => (
                  <span key={slice.key} className="admin-payments-today-metric-chip">
                    <span style={{ color: slice.fill }}>{slice.short}</span>
                    <strong>{slice.value}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="admin-payments-today-methods-chart">
              <p className="admin-payments-today-block-title">Domain readiness</p>
              <p className="admin-payments-today-methods-chart-sub">
                How complete each rules domain is for this venue.
              </p>
              <div className="admin-payments-today-methods-chart-plot">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={domainBars} margin={{ top: 8, right: 4, left: -18, bottom: 4 }}>
                    <XAxis
                      dataKey="shortLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--admin-config-subtle, #64748b)" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--admin-config-subtle, #64748b)" }}
                    />
                    <Tooltip content={<DomainBarTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.06)" }} />
                    <Bar dataKey="score" radius={[6, 6, 2, 2]} maxBarSize={28}>
                      {domainBars.map((row) => (
                        <Cell key={row.key} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </PaySection>
      </div>

      <div className="admin-payments-rules-sections">
        <PaySection
          title="Default payment mode"
          description="Consumed by Order Engine + QR sessions."
          className="admin-payments-rules-section"
        >
          <div id="rules-default-mode" className="admin-payments-method-config grid gap-3">
            <PaymentExpandSelect
              label="Default mode"
              value={settings.rules.defaultPaymentMode}
              options={MODE_OPTIONS}
              disabled={!canEdit}
              onRequestChange={(next) => {
                const mode = next as VenuePaymentSettings["rules"]["defaultPaymentMode"];
                requestConfirm({
                  title: "Change default payment mode?",
                  copy: `Default mode will become “${MODE_LABELS[mode]}”. Guests and staff will follow this path unless a channel overrides it.`,
                  confirmLabel: "Change mode",
                  apply: () =>
                    patchWithStatus(
                      { rules: { ...settings.rules, defaultPaymentMode: mode } },
                      `Default mode set to ${MODE_LABELS[mode]}.`
                    )
                });
              }}
            />
            <PaymentSwitch
              label="Payment required before preparation (online)"
              description="Prepay / online orders wait for capture before kitchen."
              checked={settings.rules.payBeforeOrder}
              disabled={!canEdit}
              onRequestChange={(payBeforeOrder) =>
                requestConfirm({
                  title: payBeforeOrder ? "Require payment before prep?" : "Allow prep before payment?",
                  copy: payBeforeOrder
                    ? "Online orders stay unpaid until payment succeeds before preparation."
                    : "Kitchen may start before online payment completes.",
                  confirmLabel: payBeforeOrder ? "Require payment" : "Allow prep",
                  danger: !payBeforeOrder,
                  apply: () =>
                    patchWithStatus(
                      { rules: { ...settings.rules, payBeforeOrder } },
                      payBeforeOrder ? "Pay-before-prep enabled." : "Pay-before-prep disabled."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Pay after meal (pay at venue path)"
              checked={settings.rules.payAfterMeal}
              disabled={!canEdit}
              onRequestChange={(payAfterMeal) =>
                requestConfirm({
                  title: payAfterMeal ? "Enable pay after meal?" : "Disable pay after meal?",
                  copy: payAfterMeal
                    ? "Guests on the pay-at-venue path can settle after dining."
                    : "Pay-after-meal will no longer be offered as a venue path.",
                  confirmLabel: payAfterMeal ? "Enable" : "Disable",
                  apply: () =>
                    patchWithStatus(
                      { rules: { ...settings.rules, payAfterMeal } },
                      payAfterMeal ? "Pay after meal enabled." : "Pay after meal disabled."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Deposit required"
              description="Reservations / large parties may require a deposit."
              checked={settings.rules.depositRequired}
              disabled={!canEdit}
              onRequestChange={(depositRequired) =>
                requestConfirm({
                  title: depositRequired ? "Require deposits?" : "Stop requiring deposits?",
                  copy: depositRequired
                    ? "Eligible bookings will require a deposit before confirmation."
                    : "Deposits will no longer be required by this rule.",
                  confirmLabel: depositRequired ? "Require deposits" : "Clear requirement",
                  danger: !depositRequired,
                  apply: () =>
                    patchWithStatus(
                      { rules: { ...settings.rules, depositRequired } },
                      depositRequired ? "Deposits required." : "Deposit requirement cleared."
                    )
                })
              }
            />
          </div>
        </PaySection>

        <PaySection
          title="Pay at venue"
          description="When settlement is expected and which channels / rails can use it."
          className="admin-payments-rules-section"
        >
          <div id="rules-pay-at-venue" className="admin-payments-method-config grid gap-3">
            <PaymentSwitch
              label="Pay at venue enabled"
              checked={payAtVenue.enabled}
              disabled={!canEdit}
              onRequestChange={(enabled) =>
                requestConfirm({
                  title: enabled ? "Enable pay at venue?" : "Disable pay at venue?",
                  copy: enabled
                    ? "Guests and staff can settle unpaid venue orders in person."
                    : "Pay-at-venue settlement will stop being offered on configured channels.",
                  confirmLabel: enabled ? "Enable" : "Disable",
                  danger: !enabled,
                  apply: () =>
                    patchWithStatus(
                      { payAtVenue: { ...payAtVenue, enabled } },
                      enabled ? "Pay at venue enabled." : "Pay at venue disabled."
                    )
                })
              }
            />
            <PaymentExpandSelect
              label="Settlement timing"
              value={payAtVenue.timing}
              options={TIMING_OPTIONS}
              disabled={!canEdit || !payAtVenue.enabled}
              onRequestChange={(next) => {
                const timing = next as typeof payAtVenue.timing;
                const label = TIMING_OPTIONS.find((o) => o.value === timing)?.label ?? timing;
                requestConfirm({
                  title: "Change pay-at-venue timing?",
                  copy: `Settlement timing will become “${label}”.`,
                  confirmLabel: "Change timing",
                  apply: () =>
                    patchWithStatus(
                      { payAtVenue: { ...payAtVenue, timing } },
                      `Pay-at-venue timing set to ${label}.`
                    )
                });
              }}
            />
            <PaymentChipGroup label="Who can use it">
              {CHANNELS.map(({ key, label }) => (
                <PaymentSourceChip
                  key={key}
                  label={label}
                  active={payAtVenue.channels[key]}
                  disabled={!canEdit || !payAtVenue.enabled}
                  onToggle={(on) =>
                    requestConfirm({
                      title: on ? `Enable ${label}?` : `Disable ${label}?`,
                      copy: on
                        ? `${label} will be able to use pay-at-venue settlement.`
                        : `${label} will no longer offer pay-at-venue.`,
                      confirmLabel: on ? "Enable" : "Disable",
                      apply: () =>
                        patchWithStatus(
                          {
                            payAtVenue: {
                              ...payAtVenue,
                              channels: { ...payAtVenue.channels, [key]: on }
                            }
                          },
                          on ? `${label} enabled for pay at venue.` : `${label} removed from pay at venue.`
                        )
                    })
                  }
                />
              ))}
            </PaymentChipGroup>
            <PaymentChipGroup label="Settlement methods">
              {SETTLEMENTS.map(({ key, label }) => (
                <PaymentSourceChip
                  key={key}
                  label={label}
                  active={payAtVenue.settlementMethods[key]}
                  disabled={!canEdit || !payAtVenue.enabled}
                  onToggle={(on) =>
                    requestConfirm({
                      title: on ? `Allow ${label}?` : `Remove ${label}?`,
                      copy: on
                        ? `${label} can be used when settling at the venue.`
                        : `${label} will no longer be offered for venue settlement.`,
                      confirmLabel: on ? "Allow" : "Remove",
                      apply: () =>
                        patchWithStatus(
                          {
                            payAtVenue: {
                              ...payAtVenue,
                              settlementMethods: { ...payAtVenue.settlementMethods, [key]: on }
                            }
                          },
                          on ? `${label} allowed.` : `${label} removed.`
                        )
                    })
                  }
                />
              ))}
            </PaymentChipGroup>
          </div>
        </PaySection>

        <PaySection
          title="QR payment policy"
          description="Must stay aligned with Order Engine + Payment Engine."
          className="admin-payments-rules-section"
        >
          <div id="rules-qr" className="admin-payments-method-config grid gap-3">
            <PaymentSwitch
              label="Allow customer to switch to pay in app"
              checked={qr.allowSwitchToApp}
              disabled={!canEdit}
              onRequestChange={(allowSwitchToApp) =>
                requestConfirm({
                  title: allowSwitchToApp ? "Allow switch to app pay?" : "Block switch to app pay?",
                  copy: allowSwitchToApp
                    ? "QR guests can move from pay-at-venue to in-app payment."
                    : "QR guests must stay on the venue payment path.",
                  confirmLabel: allowSwitchToApp ? "Allow" : "Block",
                  apply: () =>
                    patchWithStatus(
                      { qrPolicy: { ...qr, allowSwitchToApp } },
                      allowSwitchToApp ? "App switch allowed." : "App switch blocked."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Require payment before preparation"
              checked={qr.requirePaymentBeforePrep}
              disabled={!canEdit}
              onRequestChange={(requirePaymentBeforePrep) =>
                requestConfirm({
                  title: requirePaymentBeforePrep ? "Require QR payment before prep?" : "Allow prep without QR payment?",
                  copy: requirePaymentBeforePrep
                    ? "QR orders wait for payment before kitchen starts."
                    : "Kitchen may start QR orders before payment.",
                  confirmLabel: requirePaymentBeforePrep ? "Require payment" : "Allow prep",
                  danger: !requirePaymentBeforePrep,
                  apply: () =>
                    patchWithStatus(
                      { qrPolicy: { ...qr, requirePaymentBeforePrep } },
                      requirePaymentBeforePrep
                        ? "QR pay-before-prep enabled."
                        : "QR pay-before-prep disabled."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Allow unpaid orders"
              checked={qr.allowUnpaidOrders}
              disabled={!canEdit}
              onRequestChange={(allowUnpaidOrders) =>
                requestConfirm({
                  title: allowUnpaidOrders ? "Allow unpaid QR orders?" : "Block unpaid QR orders?",
                  copy: allowUnpaidOrders
                    ? "QR sessions may create orders that are not yet paid."
                    : "QR orders must be paid according to policy.",
                  confirmLabel: allowUnpaidOrders ? "Allow unpaid" : "Block unpaid",
                  danger: allowUnpaidOrders,
                  apply: () =>
                    patchWithStatus(
                      { qrPolicy: { ...qr, allowUnpaidOrders } },
                      allowUnpaidOrders ? "Unpaid QR orders allowed." : "Unpaid QR orders blocked."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Require staff confirmation"
              checked={qr.requireStaffConfirmation}
              disabled={!canEdit}
              onRequestChange={(requireStaffConfirmation) =>
                requestConfirm({
                  title: requireStaffConfirmation ? "Require staff confirmation?" : "Skip staff confirmation?",
                  copy: requireStaffConfirmation
                    ? "Staff must confirm before unpaid QR flow continues."
                    : "QR payment flow will not wait for staff confirmation.",
                  confirmLabel: requireStaffConfirmation ? "Require" : "Skip",
                  apply: () =>
                    patchWithStatus(
                      { qrPolicy: { ...qr, requireStaffConfirmation } },
                      requireStaffConfirmation
                        ? "Staff confirmation required."
                        : "Staff confirmation not required."
                    )
                })
              }
            />
            <div className="admin-payments-rules-inline-field">
              <label className="grid gap-1 max-w-xs">
                <AdminLabel>Auto-close unpaid orders (hours)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={autoCloseDraft}
                  onChange={(e) => setAutoCloseDraft(e.target.value)}
                />
              </label>
              {canEdit && autoCloseDraft !== String(qr.autoCloseUnpaidHours ?? "") ? (
                <button
                  type="button"
                  className="admin-payments-message-save"
                  onClick={() => {
                    const autoCloseUnpaidHours =
                      autoCloseDraft.trim() === "" ? null : Number(autoCloseDraft);
                    requestConfirm({
                      title: "Update auto-close hours?",
                      copy:
                        autoCloseUnpaidHours == null
                          ? "Unpaid QR orders will not auto-close on a timer."
                          : `Unpaid QR orders will auto-close after ${autoCloseUnpaidHours} hour(s).`,
                      confirmLabel: "Save",
                      apply: () =>
                        patchWithStatus(
                          { qrPolicy: { ...qr, autoCloseUnpaidHours } },
                          "Auto-close hours updated."
                        )
                    });
                  }}
                >
                  Save hours
                </button>
              ) : null}
            </div>
          </div>
        </PaySection>

        <PaySection
          title="Split payments"
          description="Each split links to the same order in the payment ledger."
          className="admin-payments-rules-section"
        >
          <div id="rules-splits" className="admin-payments-method-config grid gap-3">
            <PaymentSwitch
              label="Split payments enabled"
              checked={splits.enabled}
              disabled={!canEdit}
              onRequestChange={(enabled) =>
                requestConfirm({
                  title: enabled ? "Enable split payments?" : "Disable split payments?",
                  copy: enabled
                    ? "Guests and staff can split checks according to the options below."
                    : "Split payments will no longer be offered.",
                  confirmLabel: enabled ? "Enable" : "Disable",
                  danger: !enabled,
                  apply: () =>
                    patchWithStatus(
                      { splits: { ...splits, enabled } },
                      enabled ? "Splits enabled." : "Splits disabled."
                    )
                })
              }
            />
            <div className="admin-payments-rules-inline-field">
              <label className="grid gap-1 max-w-xs">
                <AdminLabel>Maximum splits</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit || !splits.enabled}
                  value={maxSplitsDraft}
                  onChange={(e) => setMaxSplitsDraft(e.target.value)}
                />
              </label>
              {canEdit && splits.enabled && maxSplitsDraft !== String(splits.maxSplits) ? (
                <button
                  type="button"
                  className="admin-payments-message-save"
                  onClick={() => {
                    const maxSplits = Math.max(1, Number(maxSplitsDraft) || 1);
                    requestConfirm({
                      title: "Update maximum splits?",
                      copy: `Orders will allow up to ${maxSplits} payment splits.`,
                      confirmLabel: "Save",
                      apply: () =>
                        patchWithStatus({ splits: { ...splits, maxSplits } }, `Max splits set to ${maxSplits}.`)
                    });
                  }}
                >
                  Save max
                </button>
              ) : null}
            </div>
            <PaymentChipGroup label="Split options">
              {(
                [
                  ["allowCustomerSelfSplit", "Customer self-split"],
                  ["allowStaffSplit", "Staff split"],
                  ["allowEqualSplit", "Equal split"],
                  ["allowItemBasedSplit", "Item-based"],
                  ["allowCustomAmount", "Custom amount"]
                ] as const
              ).map(([key, label]) => (
                <PaymentSourceChip
                  key={key}
                  label={label}
                  active={splits[key]}
                  disabled={!canEdit || !splits.enabled}
                  onToggle={(on) =>
                    requestConfirm({
                      title: on ? `Enable ${label}?` : `Disable ${label}?`,
                      copy: on
                        ? `${label} will be available when splitting a check.`
                        : `${label} will no longer be offered.`,
                      confirmLabel: on ? "Enable" : "Disable",
                      apply: () =>
                        patchWithStatus(
                          { splits: { ...splits, [key]: on } },
                          on ? `${label} enabled.` : `${label} disabled.`
                        )
                    })
                  }
                />
              ))}
            </PaymentChipGroup>
          </div>
        </PaySection>

        <PaySection
          title="Tips"
          description="Tips stay in their own accounting category — never mixed into item revenue."
          className="admin-payments-rules-section"
        >
          <div id="rules-tips" className="admin-payments-method-config grid gap-3">
            <PaymentSwitch
              label="Tips enabled"
              checked={tips.enabled}
              disabled={!canEdit}
              onRequestChange={(enabled) =>
                requestConfirm({
                  title: enabled ? "Enable tips?" : "Disable tips?",
                  copy: enabled
                    ? "Guests can add tips according to the presets and options below."
                    : "Tip prompts will be hidden for this venue.",
                  confirmLabel: enabled ? "Enable" : "Disable",
                  danger: !enabled,
                  apply: () =>
                    patchWithStatus(
                      {
                        tips: { ...tips, enabled },
                        taxes: { ...settings.taxes, tipsEnabled: enabled }
                      },
                      enabled ? "Tips enabled." : "Tips disabled."
                    )
                })
              }
            />
            <PaymentChipGroup label="Suggested tip percents">
              {TIP_PRESETS.map((pct) => {
                const active = tips.suggestedPercents.includes(pct);
                return (
                  <PaymentSourceChip
                    key={pct}
                    label={`${pct}%`}
                    active={active}
                    disabled={!canEdit || !tips.enabled}
                    onToggle={(on) =>
                      requestConfirm({
                        title: on ? `Add ${pct}% tip preset?` : `Remove ${pct}% tip preset?`,
                        copy: on
                          ? `${pct}% will appear as a suggested tip.`
                          : `${pct}% will be removed from suggested tips.`,
                        confirmLabel: on ? "Add" : "Remove",
                        apply: () => {
                          const suggestedPercents = on
                            ? [...new Set([...tips.suggestedPercents, pct])].sort((a, b) => a - b)
                            : tips.suggestedPercents.filter((n) => n !== pct);
                          patchWithStatus(
                            { tips: { ...tips, suggestedPercents } },
                            on ? `${pct}% tip preset added.` : `${pct}% tip preset removed.`
                          );
                        }
                      })
                    }
                  />
                );
              })}
            </PaymentChipGroup>
            <PaymentSwitch
              label="Custom tip"
              checked={tips.customTip}
              disabled={!canEdit || !tips.enabled}
              onRequestChange={(customTip) =>
                requestConfirm({
                  title: customTip ? "Allow custom tips?" : "Disable custom tips?",
                  copy: customTip
                    ? "Guests can enter any tip amount."
                    : "Guests can only pick suggested percents.",
                  confirmLabel: customTip ? "Allow" : "Disable",
                  apply: () =>
                    patchWithStatus(
                      { tips: { ...tips, customTip } },
                      customTip ? "Custom tips allowed." : "Custom tips disabled."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Tip before payment"
              checked={tips.tipBeforePayment}
              disabled={!canEdit || !tips.enabled}
              onRequestChange={(tipBeforePayment) =>
                requestConfirm({
                  title: tipBeforePayment ? "Allow tip before payment?" : "Disable tip before payment?",
                  copy: tipBeforePayment
                    ? "Guests can add a tip before capturing payment."
                    : "Tip-before-payment will be hidden.",
                  confirmLabel: tipBeforePayment ? "Allow" : "Disable",
                  apply: () =>
                    patchWithStatus(
                      { tips: { ...tips, tipBeforePayment } },
                      tipBeforePayment ? "Tip before payment enabled." : "Tip before payment disabled."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Tip after payment"
              checked={tips.tipAfterPayment}
              disabled={!canEdit || !tips.enabled}
              onRequestChange={(tipAfterPayment) =>
                requestConfirm({
                  title: tipAfterPayment ? "Allow tip after payment?" : "Disable tip after payment?",
                  copy: tipAfterPayment
                    ? "Guests can add a tip after the base payment."
                    : "Tip-after-payment will be hidden.",
                  confirmLabel: tipAfterPayment ? "Allow" : "Disable",
                  apply: () =>
                    patchWithStatus(
                      { tips: { ...tips, tipAfterPayment } },
                      tipAfterPayment ? "Tip after payment enabled." : "Tip after payment disabled."
                    )
                })
              }
            />
            <PaymentExpandSelect
              label="Cash tips"
              value={tips.cashTipsMode}
              options={CASH_TIPS_OPTIONS}
              disabled={!canEdit || !tips.enabled}
              onRequestChange={(next) => {
                const cashTipsMode = next as typeof tips.cashTipsMode;
                const label = CASH_TIPS_OPTIONS.find((o) => o.value === cashTipsMode)?.label ?? cashTipsMode;
                requestConfirm({
                  title: "Change cash tips mode?",
                  copy: `Cash tips will be set to “${label}”.`,
                  confirmLabel: "Change",
                  apply: () =>
                    patchWithStatus(
                      { tips: { ...tips, cashTipsMode } },
                      `Cash tips set to ${label}.`
                    )
                });
              }}
            />
          </div>
        </PaySection>

        <PaySection title="Failed payment behavior" className="admin-payments-rules-section">
          <div id="rules-failed" className="admin-payments-method-config grid gap-3">
            <PaymentSwitch
              label="Order remains unpaid"
              checked={failed.remainUnpaid}
              disabled={!canEdit}
              onRequestChange={(remainUnpaid) =>
                requestConfirm({
                  title: remainUnpaid ? "Keep failed orders unpaid?" : "Change failed-order state?",
                  copy: remainUnpaid
                    ? "Failed attempts leave the order unpaid for retry or staff handling."
                    : "Failed payments will not keep the order in an unpaid state by this rule.",
                  confirmLabel: "Confirm",
                  apply: () =>
                    patchWithStatus(
                      { failedPayment: { ...failed, remainUnpaid } },
                      remainUnpaid ? "Failed orders remain unpaid." : "Remain-unpaid rule cleared."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Customer can retry"
              checked={failed.allowRetry}
              disabled={!canEdit}
              onRequestChange={(allowRetry) =>
                requestConfirm({
                  title: allowRetry ? "Allow payment retry?" : "Block payment retry?",
                  copy: allowRetry
                    ? "Guests can try again after a failed payment."
                    : "Guests will not see a retry path after failure.",
                  confirmLabel: allowRetry ? "Allow retry" : "Block retry",
                  danger: !allowRetry,
                  apply: () =>
                    patchWithStatus(
                      { failedPayment: { ...failed, allowRetry } },
                      allowRetry ? "Retry allowed." : "Retry blocked."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Kitchen does not start"
              description="Protects prep when payment fails on pay-first flows."
              checked={failed.blockKitchen}
              disabled={!canEdit}
              onRequestChange={(blockKitchen) =>
                requestConfirm({
                  title: blockKitchen ? "Block kitchen on failed payment?" : "Allow kitchen after failure?",
                  copy: blockKitchen
                    ? "Kitchen will not start when payment fails."
                    : "Kitchen may continue even if payment failed.",
                  confirmLabel: blockKitchen ? "Block kitchen" : "Allow kitchen",
                  danger: !blockKitchen,
                  apply: () =>
                    patchWithStatus(
                      { failedPayment: { ...failed, blockKitchen } },
                      blockKitchen ? "Kitchen blocked on failure." : "Kitchen may run after failure."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Allow staff to accept unpaid orders"
              description="Managers/staff can override and accept risk."
              checked={failed.allowStaffAcceptUnpaid}
              disabled={!canEdit}
              onRequestChange={(allowStaffAcceptUnpaid) =>
                requestConfirm({
                  title: allowStaffAcceptUnpaid
                    ? "Allow staff to accept unpaid orders?"
                    : "Stop staff unpaid acceptance?",
                  copy: allowStaffAcceptUnpaid
                    ? "Staff can accept an order even when payment failed."
                    : "Staff cannot accept unpaid orders after failure.",
                  confirmLabel: allowStaffAcceptUnpaid ? "Allow" : "Block",
                  danger: allowStaffAcceptUnpaid,
                  apply: () =>
                    patchWithStatus(
                      { failedPayment: { ...failed, allowStaffAcceptUnpaid } },
                      allowStaffAcceptUnpaid
                        ? "Staff may accept unpaid orders."
                        : "Staff unpaid acceptance disabled."
                    )
                })
              }
            />
          </div>
        </PaySection>

        <PaySection
          title="Refund limits"
          description="Enforced by backend authorization — not the browser."
          className="admin-payments-rules-section"
        >
          <div id="rules-refunds" className="admin-payments-method-config grid gap-3">
            <div className="admin-payments-money-grid admin-payments-money-grid--compact">
              <MoneyTile
                label="Staff max"
                value={formatSekFromCents(refundLimits.staffMaxCents)}
                hint={`${refundLimits.staffMaxCents.toLocaleString()} öre`}
              />
              <MoneyTile
                label="Manager max"
                value={formatSekFromCents(refundLimits.managerMaxCents)}
                hint={`${refundLimits.managerMaxCents.toLocaleString()} öre`}
              />
              <MoneyTile
                label="Owner"
                value={refundLimits.ownerUnlimited ? "Unlimited" : "Capped"}
                hint="Backend-enforced"
              />
            </div>
            <div className="admin-payments-rules-limits-grid">
              <label className="grid gap-1">
                <AdminLabel>Staff max (öre)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={staffMaxDraft}
                  onChange={(e) => setStaffMaxDraft(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <AdminLabel>Manager max (öre)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={managerMaxDraft}
                  onChange={(e) => setManagerMaxDraft(e.target.value)}
                />
              </label>
            </div>
            {canEdit &&
            (staffMaxDraft !== String(refundLimits.staffMaxCents) ||
              managerMaxDraft !== String(refundLimits.managerMaxCents)) ? (
              <button
                type="button"
                className="admin-payments-message-save"
                onClick={() => {
                  const staffMaxCents = Math.max(0, Number(staffMaxDraft) || 0);
                  const managerMaxCents = Math.max(0, Number(managerMaxDraft) || 0);
                  requestConfirm({
                    title: "Update refund limits?",
                    copy: `Staff max ${formatSekFromCents(staffMaxCents)}, manager max ${formatSekFromCents(managerMaxCents)}.`,
                    confirmLabel: "Save limits",
                    danger: true,
                    apply: () =>
                      patchWithStatus(
                        { refundLimits: { ...refundLimits, staffMaxCents, managerMaxCents } },
                        "Refund limits updated."
                      )
                  });
                }}
              >
                Save refund limits
              </button>
            ) : null}
            <PaymentSwitch
              label="Owner unlimited"
              checked={refundLimits.ownerUnlimited}
              disabled={!canEdit}
              onRequestChange={(ownerUnlimited) =>
                requestConfirm({
                  title: ownerUnlimited ? "Allow unlimited owner refunds?" : "Cap owner refunds?",
                  copy: ownerUnlimited
                    ? "Owners can refund without a ServeOS-enforced ceiling."
                    : "Owner refunds will no longer be marked unlimited in settings.",
                  confirmLabel: ownerUnlimited ? "Allow unlimited" : "Remove unlimited",
                  danger: ownerUnlimited,
                  apply: () =>
                    patchWithStatus(
                      { refundLimits: { ...refundLimits, ownerUnlimited } },
                      ownerUnlimited ? "Owner refunds unlimited." : "Owner unlimited cleared."
                    )
                })
              }
            />
          </div>
        </PaySection>

        <PaySection
          title="Tax configuration"
          description="Detailed tax rules live under Restaurant → Taxes."
          className="admin-payments-rules-section"
        >
          <div className="admin-payments-kv">
            <span>Managed in</span>
            <strong>Restaurant → Taxes</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Orders</span>
            <strong>
              {settings.taxDisplay?.pricesIncludeTax ? "Prices include tax" : "Prices exclude tax"}
            </strong>
          </div>
          <div className="admin-payments-kv">
            <span>Tax calculation</span>
            <strong>Backend</strong>
          </div>
        </PaySection>
      </div>

      <MenuActionConfirmModal
        open={Boolean(pending)}
        title={pending?.title ?? ""}
        description={pending?.copy ?? ""}
        confirmLabel={pending?.confirmLabel}
        danger={pending?.danger}
        titleId="payment-rules-confirm-title"
        onClose={() => setPending(null)}
        onConfirm={applyConfirmed}
      />
    </div>
  );
}
