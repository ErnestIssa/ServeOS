import type { Prisma } from "@prisma/client";

export const WORKSPACE_PLAN_IDS = ["venue", "multi", "network"] as const;
export type WorkspacePlanId = (typeof WORKSPACE_PLAN_IDS)[number];

export const HARDWARE_KINDS = ["kds", "checkout", "customerStatus", "paymentTerminal", "kitchenPrinter"] as const;
export type HardwareKind = (typeof HARDWARE_KINDS)[number];

export type HardwareSlot = { enabled: boolean; quantity: number };
export type HardwareConfig = Record<HardwareKind, HardwareSlot>;

export type WorkspaceDeploymentInput = {
  planId: WorkspacePlanId;
  hardware: HardwareConfig;
};

export type WorkspaceDeploymentRecord = WorkspaceDeploymentInput & {
  confirmedAt: string;
  totalMonthlyOre: number;
  trialDays: number;
  currency: "SEK";
};

const HARDWARE_LABELS: Record<HardwareKind, string> = {
  kds: "Kitchen display",
  checkout: "Checkout screen",
  customerStatus: "Customer order status screen",
  paymentTerminal: "Payment terminal",
  kitchenPrinter: "Kitchen printer"
};

/** Monthly add-on price per extra unit (öre). Network plan includes unlimited display hardware. */
const HARDWARE_ADDON_MONTHLY_ORE: Record<HardwareKind, number> = {
  kds: 29_900,
  checkout: 24_900,
  customerStatus: 19_900,
  paymentTerminal: 14_900,
  kitchenPrinter: 9_900
};

type PlanDef = {
  id: WorkspacePlanId;
  name: string;
  baseMonthlyOre: number;
  trialDays: number;
  locationSummary: string;
  maxLocations: number | null;
  includedDisplayLines: string[];
  bestFor: string;
  recommended?: boolean;
  /** Included quantities per hardware kind (extras billed monthly). Null = unlimited included. */
  includedHardware: Record<HardwareKind, number> | null;
  defaultHardware: HardwareConfig;
};

const PLANS: PlanDef[] = [
  {
    id: "venue",
    name: "Venue",
    baseMonthlyOre: 79_900,
    trialDays: 30,
    locationSummary: "1 location",
    maxLocations: 1,
    includedDisplayLines: [
      "1 location",
      "1 kitchen display included",
      "1 checkout screen included",
      "1 customer status screen included",
      "Installation & configuration",
      "Remote support"
    ],
    bestFor: "Cafés, restaurants, food trucks, single-location venues",
    includedHardware: {
      kds: 1,
      checkout: 1,
      customerStatus: 1,
      paymentTerminal: 0,
      kitchenPrinter: 0
    },
    defaultHardware: {
      kds: { enabled: true, quantity: 1 },
      checkout: { enabled: true, quantity: 1 },
      customerStatus: { enabled: true, quantity: 1 },
      paymentTerminal: { enabled: false, quantity: 0 },
      kitchenPrinter: { enabled: false, quantity: 0 }
    }
  },
  {
    id: "multi",
    name: "Multi",
    baseMonthlyOre: 199_900,
    trialDays: 60,
    locationSummary: "2–3 locations",
    maxLocations: 3,
    includedDisplayLines: [
      "Up to 3 locations",
      "Up to 3 kitchen displays included",
      "Up to 3 checkout screens included",
      "Up to 3 customer status screens included",
      "Installation & configuration",
      "Priority support"
    ],
    bestFor: "Growing restaurants, multiple venues, high-volume operations",
    recommended: true,
    includedHardware: {
      kds: 3,
      checkout: 3,
      customerStatus: 3,
      paymentTerminal: 0,
      kitchenPrinter: 0
    },
    defaultHardware: {
      kds: { enabled: true, quantity: 2 },
      checkout: { enabled: true, quantity: 2 },
      customerStatus: { enabled: true, quantity: 2 },
      paymentTerminal: { enabled: false, quantity: 0 },
      kitchenPrinter: { enabled: false, quantity: 0 }
    }
  },
  {
    id: "network",
    name: "Network",
    baseMonthlyOre: 499_900,
    trialDays: 90,
    locationSummary: "4+ locations",
    maxLocations: null,
    includedDisplayLines: [
      "Unlimited locations",
      "Unlimited kitchen displays included",
      "Unlimited checkout screens included",
      "Unlimited customer status screens included",
      "Installation & configuration",
      "Priority deployment",
      "Dedicated success manager"
    ],
    bestFor: "Restaurant groups, franchises, chains",
    includedHardware: null,
    defaultHardware: {
      kds: { enabled: true, quantity: 4 },
      checkout: { enabled: true, quantity: 4 },
      customerStatus: { enabled: true, quantity: 4 },
      paymentTerminal: { enabled: true, quantity: 1 },
      kitchenPrinter: { enabled: false, quantity: 0 }
    }
  }
];

export const PLATFORM_INCLUDES = [
  "Customer app",
  "Staff app",
  "Admin dashboard",
  "Orders & live tracking",
  "Reservations & waitlists",
  "In-venue chat",
  "Kitchen display (KDS)",
  "Checkout screens",
  "Staff management",
  "Payments (Stripe & Swish)",
  "Push notifications",
  "Future platform updates",
  "Hardware installation & onboarding"
] as const;

function planById(planId: WorkspacePlanId): PlanDef {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw Object.assign(new Error("invalid_plan"), { statusCode: 400 });
  return plan;
}

export function normalizeHardwareConfig(raw: HardwareConfig): HardwareConfig {
  const out = {} as HardwareConfig;
  for (const kind of HARDWARE_KINDS) {
    const slot = raw[kind];
    const enabled = Boolean(slot?.enabled) && Number(slot?.quantity) > 0;
    const quantity = enabled ? Math.max(1, Math.min(99, Math.floor(Number(slot?.quantity) || 0))) : 0;
    out[kind] = { enabled, quantity };
  }
  return out;
}

function hardwareConfigsEqual(a: HardwareConfig, b: HardwareConfig): boolean {
  return HARDWARE_KINDS.every(
    (k) => a[k].enabled === b[k].enabled && a[k].quantity === b[k].quantity
  );
}

function findPlanMatchingHardware(hardware: HardwareConfig): WorkspacePlanId | null {
  for (const plan of PLANS) {
    if (hardwareConfigsEqual(hardware, plan.defaultHardware)) return plan.id;
  }
  return null;
}

function includedQty(plan: PlanDef, kind: HardwareKind): number {
  if (plan.includedHardware === null) return Number.POSITIVE_INFINITY;
  return plan.includedHardware[kind] ?? 0;
}

function additionalHardwareOre(plan: PlanDef, hardware: HardwareConfig): number {
  if (plan.includedHardware === null) return 0;
  let total = 0;
  for (const kind of HARDWARE_KINDS) {
    const slot = hardware[kind];
    if (!slot.enabled || slot.quantity <= 0) continue;
    const included = includedQty(plan, kind);
    const extra = Math.max(0, slot.quantity - included);
    if (extra > 0) total += extra * HARDWARE_ADDON_MONTHLY_ORE[kind];
  }
  return total;
}

export function matchesPlanDefaultBundle(planId: WorkspacePlanId, hardware: HardwareConfig): boolean {
  const plan = planById(planId);
  return hardwareConfigsEqual(hardware, plan.defaultHardware);
}

export function needsDeploymentReview(planId: WorkspacePlanId, hardware: HardwareConfig): boolean {
  if (!matchesPlanDefaultBundle(planId, hardware)) return true;
  const plan = planById(planId);
  return additionalHardwareOre(plan, hardware) > 0;
}

export type DeploymentQuoteHardwareLine = {
  kind: HardwareKind;
  label: string;
  quantity: number;
  includedQuantity: number;
  additionalQuantity: number;
  unitAddonMonthlyOre: number;
  lineAddonMonthlyOre: number;
};

export type DeploymentQuote = {
  planId: WorkspacePlanId;
  planName: string;
  locationSummary: string;
  trialDays: number;
  currency: "SEK";
  baseMonthlyOre: number;
  additionalHardwareMonthlyOre: number;
  totalMonthlyOre: number;
  matchesPlanDefaultBundle: boolean;
  needsReview: boolean;
  suggestedPlanId: WorkspacePlanId | null;
  suggestedPlanName: string | null;
  hardwareLines: DeploymentQuoteHardwareLine[];
  summaryLines: string[];
};

function formatOre(ore: number): string {
  const kr = Math.round(ore / 100);
  return `${kr.toLocaleString("sv-SE")} kr/month`;
}

export function quoteWorkspaceDeployment(input: WorkspaceDeploymentInput): DeploymentQuote {
  const plan = planById(input.planId);
  const hardware = normalizeHardwareConfig(input.hardware);

  const hasEnabled = HARDWARE_KINDS.some((k) => hardware[k].enabled && hardware[k].quantity > 0);
  if (!hasEnabled) {
    throw Object.assign(new Error("hardware_required"), { statusCode: 400 });
  }

  const hardwareLines: DeploymentQuoteHardwareLine[] = [];
  for (const kind of HARDWARE_KINDS) {
    const slot = hardware[kind];
    if (!slot.enabled || slot.quantity <= 0) continue;
    const includedQuantity =
      plan.includedHardware === null ? slot.quantity : Math.min(slot.quantity, includedQty(plan, kind));
    const additionalQuantity =
      plan.includedHardware === null ? 0 : Math.max(0, slot.quantity - includedQty(plan, kind));
    hardwareLines.push({
      kind,
      label: HARDWARE_LABELS[kind],
      quantity: slot.quantity,
      includedQuantity,
      additionalQuantity,
      unitAddonMonthlyOre: HARDWARE_ADDON_MONTHLY_ORE[kind],
      lineAddonMonthlyOre: additionalQuantity * HARDWARE_ADDON_MONTHLY_ORE[kind]
    });
  }

  const additionalHardwareMonthlyOre = additionalHardwareOre(plan, hardware);
  const totalMonthlyOre = plan.baseMonthlyOre + additionalHardwareMonthlyOre;
  const exactMatchPlanId = findPlanMatchingHardware(hardware);
  const matchesDefault = matchesPlanDefaultBundle(input.planId, hardware);
  const needsReview = needsDeploymentReview(input.planId, hardware);

  let suggestedPlanId: WorkspacePlanId | null = null;
  if (exactMatchPlanId && exactMatchPlanId !== input.planId) {
    suggestedPlanId = exactMatchPlanId;
  }

  const summaryLines = [
    `${plan.name} plan — ${plan.locationSummary}`,
    `Platform subscription: ${formatOre(plan.baseMonthlyOre)}`,
    ...(additionalHardwareMonthlyOre > 0
      ? [`Additional hardware: ${formatOre(additionalHardwareMonthlyOre)}`]
      : ["All hardware within plan inclusion"]),
    `Total: ${formatOre(totalMonthlyOre)}`,
    `${plan.trialDays}-day free trial`
  ];

  if (suggestedPlanId) {
    const suggested = planById(suggestedPlanId);
    summaryLines.push(`Your hardware selection matches the ${suggested.name} plan bundle.`);
  }

  return {
    planId: input.planId,
    planName: plan.name,
    locationSummary: plan.locationSummary,
    trialDays: plan.trialDays,
    currency: "SEK",
    baseMonthlyOre: plan.baseMonthlyOre,
    additionalHardwareMonthlyOre,
    totalMonthlyOre,
    matchesPlanDefaultBundle: matchesDefault,
    needsReview,
    suggestedPlanId,
    suggestedPlanName: suggestedPlanId ? planById(suggestedPlanId).name : null,
    hardwareLines,
    summaryLines
  };
}

export function listWorkspacePlansForClient() {
  return PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceLabel: formatOre(plan.baseMonthlyOre),
    trialLabel: `${plan.trialDays}-day trial`,
    locationSummary: plan.locationSummary,
    included: plan.includedDisplayLines,
    bestFor: plan.bestFor,
    recommended: plan.recommended ?? false,
    defaultHardware: plan.defaultHardware
  }));
}

export function listHardwareCatalogForClient() {
  return HARDWARE_KINDS.map((kind) => ({
    id: kind,
    label: HARDWARE_LABELS[kind],
    description:
      kind === "kds"
        ? "Live kitchen tickets for your prep line"
        : kind === "checkout"
          ? "Front-of-house order and payment screen"
          : kind === "customerStatus"
            ? "Live order status TV for guests"
            : kind === "paymentTerminal"
              ? "Card terminal — installed and configured by ServeOS"
              : "Ticket printer for backup or expo stations",
    addonMonthlyLabel: formatOre(HARDWARE_ADDON_MONTHLY_ORE[kind])
  }));
}

const DEPLOYMENT_PROFILE_KEY = "workspaceDeployment";

export function readWorkspaceDeploymentFromProfile(signupProfile: unknown): WorkspaceDeploymentRecord | null {
  if (!signupProfile || typeof signupProfile !== "object" || Array.isArray(signupProfile)) return null;
  const raw = (signupProfile as Record<string, unknown>)[DEPLOYMENT_PROFILE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as WorkspaceDeploymentRecord;
  if (!WORKSPACE_PLAN_IDS.includes(d.planId as WorkspacePlanId)) return null;
  if (!d.confirmedAt || typeof d.totalMonthlyOre !== "number") return null;
  return d;
}

export async function confirmWorkspaceDeployment(
  prisma: { user: { findUnique: Function; update: Function } },
  userId: string,
  input: WorkspaceDeploymentInput
): Promise<WorkspaceDeploymentRecord> {
  const quote = quoteWorkspaceDeployment(input);
  const hardware = normalizeHardwareConfig(input.hardware);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupProfile: true, role: true }
  });
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });
  if (user.role !== "OWNER") throw Object.assign(new Error("owner_only"), { statusCode: 403 });

  const prevProfile =
    user.signupProfile && typeof user.signupProfile === "object" && !Array.isArray(user.signupProfile)
      ? (user.signupProfile as Record<string, unknown>)
      : {};

  const record: WorkspaceDeploymentRecord = {
    planId: input.planId,
    hardware,
    confirmedAt: new Date().toISOString(),
    totalMonthlyOre: quote.totalMonthlyOre,
    trialDays: quote.trialDays,
    currency: "SEK"
  };

  const nextProfile: Prisma.InputJsonValue = {
    ...prevProfile,
    [DEPLOYMENT_PROFILE_KEY]: record
  };

  await prisma.user.update({
    where: { id: userId },
    data: { signupProfile: nextProfile }
  });

  return record;
}
