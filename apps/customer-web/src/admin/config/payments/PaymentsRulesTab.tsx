import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { VenuePaymentSettings } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { renderPaymentPieSliceLabel } from "./paymentPieLabels";
import { type PaymentSelectOption } from "./paymentsFormControls";
import { PaySection } from "./paymentsShared";
import { PaymentRulesDomainDrawer, type PaymentRulesDomainDetail } from "./PaymentRulesDomainDrawer";
import {
  ADVANCED_RULE_BY_SECTION,
  PaymentAdvancedRulesDrawer,
  type AdvancedRuleKey
} from "./PaymentAdvancedRulesDrawer";
import { PaymentPayAtVenueCard } from "./PaymentPayAtVenueCard";
import {
  PaymentBehaviorModeCards,
  PaymentBehaviorPrepToggles,
  buildPaymentBehaviorPatch,
  paymentBehaviorLabel,
  resolvePaymentBehavior,
  type PaymentBehaviorId
} from "./PaymentDefaultBehaviorSection";
import { formatSekFromCents, centsToKronor, formatKronorLabel, PAY_AT_VENUE_TIMING_OPTIONS } from "./paymentsUiHelpers";

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

type DomainSlice = {
  key: string;
  label: string;
  short: string;
  value: number;
  score: number;
  fill: string;
  statusLabel: string;
  sectionId: string;
  impact: string;
  recommendedAction: string;
  facts: Array<{ label: string; value: string }>;
  badgeLabel?: string;
  sectionHint?: string;
};

const TIMING_OPTIONS: PaymentSelectOption[] = PAY_AT_VENUE_TIMING_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
  hint: opt.hint
}));

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

function scoreDomain(on: boolean, weight = 1) {
  return on ? weight : 0;
}

function DomainTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: DomainSlice }>;
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

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function PaymentsRulesTab({ settings, canEdit, onPatch }: Props) {
  const payAtVenue = settings.payAtVenue ?? {
    enabled: true,
    timing: "when_bill_requested" as const,
    channels: { qrOrders: true, walkIns: true, staffCreated: true, reservations: true, delivery: false },
    settlementMethods: { cash: true, cardTerminal: true, swish: true, other: false },
    cardTerminal: { mode: "external_manual" as const, terminalId: null },
    other: { label: "", requireStaffConfirmation: true }
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

  const { pushToast } = useAdminToast();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [advancedRule, setAdvancedRule] = useState<AdvancedRuleKey | null>(null);
  const [activeDomainSlice, setActiveDomainSlice] = useState<number | null>(null);
  const [activePolicySlice, setActivePolicySlice] = useState<number | null>(null);
  const [domainDetailOpen, setDomainDetailOpen] = useState(false);
  const [domainDetail, setDomainDetail] = useState<PaymentRulesDomainDetail | null>(null);
  const domainPieRef = useRef<HTMLDivElement | null>(null);
  const policyPieRef = useRef<HTMLDivElement | null>(null);
  const domainSlicesRef = useRef<DomainSlice[]>([]);
  const policySlicesRef = useRef<DomainSlice[]>([]);
  const [autoCloseDraft, setAutoCloseDraft] = useState(String(qr.autoCloseUnpaidHours ?? ""));
  const [maxSplitsDraft, setMaxSplitsDraft] = useState(String(splits.maxSplits));
  const [staffMaxDraft, setStaffMaxDraft] = useState(formatKronorLabel(centsToKronor(refundLimits.staffMaxCents)));
  const [managerMaxDraft, setManagerMaxDraft] = useState(
    formatKronorLabel(centsToKronor(refundLimits.managerMaxCents))
  );

  useEffect(() => {
    setAutoCloseDraft(String(qr.autoCloseUnpaidHours ?? ""));
  }, [qr.autoCloseUnpaidHours]);
  useEffect(() => {
    setMaxSplitsDraft(String(splits.maxSplits));
  }, [splits.maxSplits]);
  useEffect(() => {
    setStaffMaxDraft(formatKronorLabel(centsToKronor(refundLimits.staffMaxCents)));
  }, [refundLimits.staffMaxCents]);
  useEffect(() => {
    setManagerMaxDraft(formatKronorLabel(centsToKronor(refundLimits.managerMaxCents)));
  }, [refundLimits.managerMaxCents]);

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
    pushToast(message, "success");
  };

  const channelCount = CHANNELS.filter((c) => payAtVenue.channels[c.key]).length;
  const settlementCount = SETTLEMENTS.filter((s) => payAtVenue.settlementMethods[s.key]).length;
  const tipCount = tips.suggestedPercents.length;

  const domainSlices: DomainSlice[] = useMemo(() => {
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
        20
    );

    const timing =
      PAY_AT_VENUE_TIMING_OPTIONS.find((o) => o.value === payAtVenue.timing)?.label ?? payAtVenue.timing;
    const behavior = resolvePaymentBehavior(settings.rules);
    const modeLabel = paymentBehaviorLabel(behavior);

    const rows: Array<Omit<DomainSlice, "value" | "statusLabel">> = [
      {
        key: "mode",
        label: "Default payment behavior",
        short: "Mode",
        score: 100,
        fill: "#2563eb",
        sectionId: "rules-default-mode",
        impact: `Guests and staff follow “${modeLabel}” unless a channel overrides it.`,
        recommendedAction: "Review default payment behavior if your venue mixes pay-first and pay-at-venue flows.",
        facts: [
          { label: "Default behavior", value: modeLabel },
          { label: "Pay before prep", value: settings.rules.payBeforeOrder ? "On" : "Off" },
          { label: "Pay at venue path", value: settings.rules.payAfterMeal ? "On" : "Off" },
          { label: "Deposit required", value: settings.rules.depositRequired ? "On" : "Off" }
        ]
      },
      {
        key: "venue",
        label: "Pay at venue",
        short: "Venue",
        score: payAtVenue.enabled ? Math.round((channelScore + settlementScore) / 2) : 0,
        fill: "#0ea5e9",
        sectionId: "rules-pay-at-venue",
        impact: payAtVenue.enabled
          ? `Settlement timing is “${timing}” across ${channelCount} channels.`
          : "Pay at venue is off — in-person settlement is not offered.",
        recommendedAction: payAtVenue.enabled
          ? "Confirm channels and settlement methods match how your floor takes payment."
          : "Enable pay at venue if guests settle in person.",
        facts: [
          { label: "Enabled", value: payAtVenue.enabled ? "Yes" : "No" },
          { label: "Timing", value: timing },
          { label: "Channels", value: `${channelCount} of ${CHANNELS.length}` },
          { label: "Settlement methods", value: `${settlementCount} of ${SETTLEMENTS.length}` }
        ]
      },
      {
        key: "qr",
        label: "QR policy",
        short: "QR",
        score: qrScore,
        fill: "#8b5cf6",
        sectionId: "rules-qr",
        impact: "Controls how QR orders move between pay-at-venue and in-app payment.",
        recommendedAction: "Align QR payment-before-prep with your kitchen flow.",
        facts: [
          { label: "Switch to app", value: qr.allowSwitchToApp ? "Allowed" : "Blocked" },
          { label: "Pay before prep", value: qr.requirePaymentBeforePrep ? "Required" : "Not required" },
          { label: "Unpaid orders", value: qr.allowUnpaidOrders ? "Allowed" : "Blocked" },
          {
            label: "Auto-close unpaid",
            value: qr.autoCloseUnpaidHours == null ? "Off" : `${qr.autoCloseUnpaidHours}h`
          }
        ]
      },
      {
        key: "splits",
        label: "Splits",
        short: "Split",
        score: splitScore,
        fill: "#16a34a",
        sectionId: "rules-splits",
        impact: splits.enabled
          ? `Guests and staff can split a check into up to ${splits.maxSplits} parts.`
          : "Split payments are disabled for this venue.",
        recommendedAction: splits.enabled
          ? "Review which split types you allow on the floor."
          : "Enable splits if tables often share the bill.",
        facts: [
          { label: "Enabled", value: splits.enabled ? "Yes" : "No" },
          { label: "Max splits", value: String(splits.maxSplits) },
          { label: "Customer self-split", value: splits.allowCustomerSelfSplit ? "On" : "Off" },
          { label: "Staff split", value: splits.allowStaffSplit ? "On" : "Off" }
        ]
      },
      {
        key: "tips",
        label: "Tips",
        short: "Tips",
        score: tipScore,
        fill: "#d97706",
        sectionId: "rules-tips",
        impact: tips.enabled
          ? `${tipCount} suggested tip preset${tipCount === 1 ? "" : "s"} are offered at checkout.`
          : "Tip prompts are hidden for this venue.",
        recommendedAction: tips.enabled
          ? "Confirm tip presets and when tips can be added."
          : "Enable tips if you want suggested percents at payment.",
        facts: [
          { label: "Enabled", value: tips.enabled ? "Yes" : "No" },
          {
            label: "Presets",
            value: tips.suggestedPercents.length
              ? tips.suggestedPercents.map((n) => `${n}%`).join(" · ")
              : "None"
          },
          { label: "Custom tip", value: tips.customTip ? "Allowed" : "Off" },
          { label: "Cash tips", value: tips.cashTipsMode === "track_manually" ? "Track manually" : "Ignore" }
        ]
      },
      {
        key: "failed",
        label: "Failed payments",
        short: "Fail",
        score: failedScore,
        fill: "#dc2626",
        sectionId: "rules-failed",
        impact: failed.blockKitchen
          ? "Failed payments keep the kitchen from starting on pay-first flows."
          : "Kitchen may continue even when payment fails.",
        recommendedAction: "Confirm retry and unpaid-accept rules match your risk tolerance.",
        facts: [
          { label: "Remain unpaid", value: failed.remainUnpaid ? "Yes" : "No" },
          { label: "Customer retry", value: failed.allowRetry ? "Allowed" : "Blocked" },
          { label: "Block kitchen", value: failed.blockKitchen ? "Yes" : "No" },
          { label: "Staff accept unpaid", value: failed.allowStaffAcceptUnpaid ? "Allowed" : "Blocked" }
        ]
      },
      {
        key: "refunds",
        label: "Refund permissions",
        short: "Refund",
        score: refundScore,
        fill: "#64748b",
        sectionId: "rules-refunds",
        impact: "Caps how much staff and managers can refund without owner override.",
        recommendedAction: "Keep staff and manager caps aligned with your refund policy.",
        facts: [
          { label: "Staff max", value: formatSekFromCents(refundLimits.staffMaxCents) },
          { label: "Manager max", value: formatSekFromCents(refundLimits.managerMaxCents) },
          { label: "Owner", value: "No limit" }
        ]
      }
    ];

    return rows.map((row) => ({
      ...row,
      value: 1,
      statusLabel: `${row.score}% configured`
    }));
  }, [
    channelCount,
    settlementCount,
    tipCount,
    tips,
    splits,
    qr,
    failed,
    refundLimits,
    payAtVenue,
    settings.rules
  ]);

  const timingLabel =
    PAY_AT_VENUE_TIMING_OPTIONS.find((o) => o.value === payAtVenue.timing)?.label ?? payAtVenue.timing;

  const policySlices: DomainSlice[] = useMemo(() => {
    const behavior = resolvePaymentBehavior(settings.rules);
    const modeLabel = paymentBehaviorLabel(behavior);
    const venueValue = payAtVenue.enabled ? timingLabel : "Off";
    const splitsValue = splits.enabled ? `Max ${splits.maxSplits}` : "Off";
    const tipsValue = tips.enabled ? `${tipCount} presets` : "Off";
    const refundValue = formatSekFromCents(refundLimits.staffMaxCents);
    const failedValue = failed.blockKitchen ? "Block kitchen" : "Kitchen open";

    const rows: Array<Omit<DomainSlice, "value">> = [
      {
        key: "snapshot-mode",
        label: "Default payment behavior",
        short: "Mode",
        score: 100,
        fill: "#2563eb",
        statusLabel: modeLabel,
        badgeLabel: modeLabel,
        sectionId: "rules-default-mode",
        sectionHint: "Current guest checkout default for this venue.",
        impact: `Guests and staff follow “${modeLabel}” unless a channel overrides it.`,
        recommendedAction: "Review default payment behavior if your venue mixes pay-first and pay-at-venue flows.",
        facts: [
          { label: "Default behavior", value: modeLabel },
          { label: "Pay before prep", value: settings.rules.payBeforeOrder ? "On" : "Off" },
          { label: "Pay at venue path", value: settings.rules.payAfterMeal ? "On" : "Off" },
          { label: "Deposit required", value: settings.rules.depositRequired ? "On" : "Off" }
        ]
      },
      {
        key: "snapshot-venue",
        label: "Pay at venue",
        short: "Venue",
        score: payAtVenue.enabled ? 100 : 0,
        fill: "#0ea5e9",
        statusLabel: venueValue,
        badgeLabel: venueValue,
        sectionId: "rules-pay-at-venue",
        sectionHint: "When and how guests settle in person.",
        impact: payAtVenue.enabled
          ? `Settlement timing is “${timingLabel}” across ${channelCount} channels.`
          : "Pay at venue is off — in-person settlement is not offered.",
        recommendedAction: payAtVenue.enabled
          ? "Confirm channels and settlement methods match how your floor takes payment."
          : "Enable pay at venue if guests settle in person.",
        facts: [
          { label: "Enabled", value: payAtVenue.enabled ? "Yes" : "No" },
          { label: "Timing", value: timingLabel },
          { label: "Channels", value: `${channelCount} of ${CHANNELS.length}` },
          { label: "Settlement methods", value: `${settlementCount} of ${SETTLEMENTS.length}` }
        ]
      },
      {
        key: "snapshot-splits",
        label: "Splits",
        short: "Split",
        score: splits.enabled ? 100 : 0,
        fill: "#16a34a",
        statusLabel: splitsValue,
        badgeLabel: splitsValue,
        sectionId: "rules-splits",
        sectionHint: "How checks can be split at this venue.",
        impact: splits.enabled
          ? `Guests and staff can split a check into up to ${splits.maxSplits} parts.`
          : "Split payments are disabled for this venue.",
        recommendedAction: splits.enabled
          ? "Review which split types you allow on the floor."
          : "Enable splits if tables often share the bill.",
        facts: [
          { label: "Enabled", value: splits.enabled ? "Yes" : "No" },
          { label: "Max splits", value: String(splits.maxSplits) },
          { label: "Customer self-split", value: splits.allowCustomerSelfSplit ? "On" : "Off" },
          { label: "Staff split", value: splits.allowStaffSplit ? "On" : "Off" }
        ]
      },
      {
        key: "snapshot-tips",
        label: "Tips",
        short: "Tips",
        score: tips.enabled ? 100 : 0,
        fill: "#d97706",
        statusLabel: tipsValue,
        badgeLabel: tipsValue,
        sectionId: "rules-tips",
        sectionHint: "Tip presets and options offered at payment.",
        impact: tips.enabled
          ? `${tipCount} suggested tip preset${tipCount === 1 ? "" : "s"} are offered at checkout.`
          : "Tip prompts are hidden for this venue.",
        recommendedAction: tips.enabled
          ? "Confirm tip presets and when tips can be added."
          : "Enable tips if you want suggested percents at payment.",
        facts: [
          { label: "Enabled", value: tips.enabled ? "Yes" : "No" },
          {
            label: "Presets",
            value: tips.suggestedPercents.length
              ? tips.suggestedPercents.map((n) => `${n}%`).join(" · ")
              : "None"
          },
          { label: "Custom tip", value: tips.customTip ? "Allowed" : "Off" },
          { label: "Cash tips", value: tips.cashTipsMode === "track_manually" ? "Track manually" : "Ignore" }
        ]
      },
      {
        key: "snapshot-refunds",
        label: "Staff refund cap",
        short: "Refund",
        score: 100,
        fill: "#64748b",
        statusLabel: refundValue,
        badgeLabel: refundValue,
        sectionId: "rules-refunds",
        sectionHint: "Refund ceilings for staff and managers.",
        impact: "Caps how much staff and managers can refund without owner override.",
        recommendedAction: "Keep staff and manager caps aligned with your refund policy.",
        facts: [
          { label: "Staff max", value: formatSekFromCents(refundLimits.staffMaxCents) },
          { label: "Manager max", value: formatSekFromCents(refundLimits.managerMaxCents) },
          { label: "Owner", value: "No limit" }
        ]
      },
      {
        key: "snapshot-failed",
        label: "Failed payments",
        short: "Fail",
        score: 100,
        fill: "#dc2626",
        statusLabel: failedValue,
        badgeLabel: failedValue,
        sectionId: "rules-failed",
        sectionHint: "What happens when a guest payment fails.",
        impact: failed.blockKitchen
          ? "Failed payments keep the kitchen from starting on pay-first flows."
          : "Kitchen may continue even when payment fails.",
        recommendedAction: "Confirm retry and unpaid-accept rules match your risk tolerance.",
        facts: [
          { label: "Remain unpaid", value: failed.remainUnpaid ? "Yes" : "No" },
          { label: "Customer retry", value: failed.allowRetry ? "Allowed" : "Blocked" },
          { label: "Block kitchen", value: failed.blockKitchen ? "Yes" : "No" },
          { label: "Staff accept unpaid", value: failed.allowStaffAcceptUnpaid ? "Allowed" : "Blocked" }
        ]
      }
    ];

    return rows.map((row) => ({ ...row, value: 1 }));
  }, [
    channelCount,
    settlementCount,
    tipCount,
    tips,
    splits,
    failed,
    refundLimits,
    payAtVenue,
    settings.rules,
    timingLabel
  ]);

  domainSlicesRef.current = domainSlices;
  policySlicesRef.current = policySlices;

  const openDomainDetail = useCallback((slice: DomainSlice | undefined) => {
    if (!slice) return;
    setDomainDetail({
      key: slice.key,
      label: slice.label,
      score: slice.score,
      fill: slice.fill,
      statusLabel: slice.statusLabel,
      sectionId: slice.sectionId,
      impact: slice.impact,
      recommendedAction: slice.recommendedAction,
      facts: slice.facts,
      badgeLabel: slice.badgeLabel,
      sectionHint: slice.sectionHint
    });
    setDomainDetailOpen(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useEffect(() => {
    const bindPieClicks = (root: HTMLDivElement | null, slicesRef: { current: DomainSlice[] }) => {
      if (!root) return () => {};
      const onPieClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (!target) return;
        const sectorLayer = target.closest(".recharts-pie-sector");
        if (!sectorLayer || !root.contains(sectorLayer)) return;
        const sectors = Array.from(root.querySelectorAll(":scope .recharts-pie-sector"));
        const index = sectors.indexOf(sectorLayer as Element);
        if (index < 0) return;
        openDomainDetail(slicesRef.current[index]);
      };
      root.addEventListener("click", onPieClick);
      return () => root.removeEventListener("click", onPieClick);
    };

    const unbindDomain = bindPieClicks(domainPieRef.current, domainSlicesRef);
    const unbindPolicy = bindPieClicks(policyPieRef.current, policySlicesRef);
    return () => {
      unbindDomain();
      unbindPolicy();
    };
  }, [openDomainDetail]);

  return (
    <div className="admin-payments-tab-stack admin-payments-rules-page">
      <div className="admin-payments-methods-board-head">
        <p className="admin-payments-methods-board-desc">
          Guest checkout policy for this venue — default mode, pay-at-venue timing, QR, splits, tips, failed-payment behavior, and refund limits. Changes stay local until you save.
        </p>
      </div>

      <div className="admin-payments-overview-grid admin-payments-overview-grid--with-behavior">
        <div className="admin-payments-overview-col">
          <PaySection title="Policy snapshot" borderless>
            <div className="admin-payments-health-pie">
              <div
                ref={policyPieRef}
                className="admin-payments-health-pie-chart admin-payments-rules-domain-pie"
                role="img"
                aria-label="Policy snapshot. Click a slice for details."
              >
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart margin={{ top: 10, right: 18, bottom: 10, left: 18 }}>
                    <Tooltip cursor={false} content={<DomainTooltip />} />
                    <Pie
                      data={policySlices}
                      dataKey="value"
                      nameKey="short"
                      stroke="none"
                      isAnimationActive={false}
                      innerRadius={0}
                      outerRadius={96}
                      paddingAngle={1.5}
                      onMouseEnter={(_, index) => setActivePolicySlice(index)}
                      onMouseLeave={() => setActivePolicySlice(null)}
                      onClick={(sector, index) => {
                        const fromSector =
                          policySlices.find((s) => s.key === (sector as { key?: string }).key) ??
                          policySlices.find(
                            (s) => s.key === (sector as { payload?: { key?: string } }).payload?.key
                          ) ??
                          policySlices[index];
                        openDomainDetail(fromSector);
                      }}
                      label={(props) =>
                        renderPaymentPieSliceLabel(props, props.index === activePolicySlice)
                      }
                      labelLine={false}
                      style={{ cursor: "pointer", outline: "none" }}
                    >
                      {policySlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.fill} style={{ outline: "none", cursor: "pointer" }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </PaySection>
          <PaymentBehaviorModeCards
            settings={settings}
            canEdit={canEdit}
            onRequestBehaviorChange={(behavior: PaymentBehaviorId) => {
              const label = paymentBehaviorLabel(behavior);
              requestConfirm({
                title: `Switch to “${label}”?`,
                copy: `Default payment behavior will become “${label}”. QR ordering and the Order Engine will follow this path unless a channel overrides it.`,
                confirmLabel: "Change behavior",
                apply: () =>
                  patchWithStatus(
                    buildPaymentBehaviorPatch(behavior, settings),
                    `Default payment behavior set to ${label}.`
                  )
              });
            }}
          />
        </div>

        <div className="admin-payments-overview-col">
          <PaySection title="Rules completeness" borderless>
            <div className="admin-payments-health-pie">
              <div
                ref={domainPieRef}
                className="admin-payments-health-pie-chart admin-payments-rules-domain-pie"
                role="img"
                aria-label="Rules domain completeness. Click a slice for details."
              >
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart margin={{ top: 10, right: 18, bottom: 10, left: 18 }}>
                    <Tooltip cursor={false} content={<DomainTooltip />} />
                    <Pie
                      data={domainSlices}
                      dataKey="value"
                      nameKey="short"
                      stroke="none"
                      isAnimationActive={false}
                      innerRadius={0}
                      outerRadius={96}
                      paddingAngle={1.5}
                      onMouseEnter={(_, index) => setActiveDomainSlice(index)}
                      onMouseLeave={() => setActiveDomainSlice(null)}
                      onClick={(sector, index) => {
                        const fromSector =
                          domainSlices.find((s) => s.key === (sector as { key?: string }).key) ??
                          domainSlices.find(
                            (s) => s.key === (sector as { payload?: { key?: string } }).payload?.key
                          ) ??
                          domainSlices[index];
                        openDomainDetail(fromSector);
                      }}
                      label={(props) =>
                        renderPaymentPieSliceLabel(props, props.index === activeDomainSlice)
                      }
                      labelLine={false}
                      style={{ cursor: "pointer", outline: "none" }}
                    >
                      {domainSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.fill} style={{ outline: "none", cursor: "pointer" }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </PaySection>
          <PaymentBehaviorPrepToggles
            canEdit={canEdit}
            failed={failed}
            qr={qr}
            onRequestFailedKitchenBlock={(blockKitchen) =>
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
            onRequestQrPayBeforePrep={(requirePaymentBeforePrep) =>
              requestConfirm({
                title: requirePaymentBeforePrep
                  ? "Require QR payment before prep?"
                  : "Allow prep without QR payment?",
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
        </div>
      </div>

      <div className="admin-payments-rules-sections">
        <PaymentPayAtVenueCard
          payAtVenue={payAtVenue}
          canEdit={canEdit}
          advancedRule={advancedRule}
          onOpenAdvanced={(key) => {
            setPending(null);
            setAdvancedRule(key);
          }}
          onRequestEnabled={(enabled) =>
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
          onRequestTiming={(timing) => {
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
          onRequestChannel={(key, on) => {
            const label = CHANNELS.find((c) => c.key === key)?.label ?? key;
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
            });
          }}
          onRequestSettlement={(key, on) => {
            const label = SETTLEMENTS.find((s) => s.key === key)?.label ?? key;
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
            });
          }}
          onRequestCardTerminalMode={(mode) =>
            requestConfirm({
              title: "Update card terminal mode?",
              copy:
                mode === "connected"
                  ? "Card settlement will use a linked terminal or integration when available."
                  : "Staff will confirm card payments taken on an external terminal.",
              confirmLabel: "Update terminal",
              apply: () =>
                patchWithStatus(
                  {
                    payAtVenue: {
                      ...payAtVenue,
                      cardTerminal: {
                        ...(payAtVenue.cardTerminal ?? { terminalId: null }),
                        mode
                      }
                    }
                  },
                  mode === "connected"
                    ? "Card terminal set to connected integration."
                    : "Card terminal set to external manual confirmation."
                )
            })
          }
          onRequestOtherLabel={(label) =>
            patchWithStatus(
              {
                payAtVenue: {
                  ...payAtVenue,
                  other: {
                    ...(payAtVenue.other ?? { requireStaffConfirmation: true }),
                    label
                  }
                }
              },
              "Other payment method updated."
            )
          }
          onRequestOtherStaffConfirm={(requireStaffConfirmation) =>
            requestConfirm({
              title: requireStaffConfirmation
                ? "Require staff confirmation for Other?"
                : "Skip staff confirmation for Other?",
              copy: requireStaffConfirmation
                ? "Staff must confirm before an Other settlement closes the check."
                : "Other settlements can close without an extra staff confirmation step.",
              confirmLabel: requireStaffConfirmation ? "Require" : "Skip",
              apply: () =>
                patchWithStatus(
                  {
                    payAtVenue: {
                      ...payAtVenue,
                      other: {
                        ...(payAtVenue.other ?? { label: "" }),
                        requireStaffConfirmation
                      }
                    }
                  },
                  requireStaffConfirmation
                    ? "Staff confirmation required for Other."
                    : "Staff confirmation not required for Other."
                )
            })
          }
        />
      </div>

      <PaymentAdvancedRulesDrawer
        ruleKey={advancedRule}
        open={Boolean(advancedRule)}
        canEdit={canEdit}
        qr={qr}
        splits={splits}
        tips={tips}
        failed={failed}
        refundLimits={refundLimits}
        taxes={settings.taxes}
        pricesIncludeTax={settings.taxDisplay?.pricesIncludeTax !== false}
        autoCloseDraft={autoCloseDraft}
        maxSplitsDraft={maxSplitsDraft}
        staffMaxDraft={staffMaxDraft}
        managerMaxDraft={managerMaxDraft}
        pending={advancedRule ? pending : null}
        onClose={() => setAdvancedRule(null)}
        onAutoCloseDraft={setAutoCloseDraft}
        onMaxSplitsDraft={setMaxSplitsDraft}
        onStaffMaxDraft={setStaffMaxDraft}
        onManagerMaxDraft={setManagerMaxDraft}
        onApplyPatch={patchWithStatus}
        onRequestConfirm={requestConfirm}
        onCancelPending={() => setPending(null)}
        onConfirmPending={applyConfirmed}
      />

      <PaymentRulesDomainDrawer
        detail={domainDetail}
        open={domainDetailOpen}
        onClose={() => {
          setDomainDetailOpen(false);
        }}
        onGoToSection={(id) => {
          const rule = ADVANCED_RULE_BY_SECTION[id];
          if (rule) {
            setDomainDetailOpen(false);
            setPending(null);
            setAdvancedRule(rule);
            return;
          }
          scrollToSection(id);
        }}
      />

      <MenuActionConfirmModal
        open={Boolean(pending) && !advancedRule}
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
