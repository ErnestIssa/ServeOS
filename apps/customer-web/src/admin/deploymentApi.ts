import { getApiBaseUrl } from "../api";

export type WorkspacePlanId = "venue" | "multi" | "network";

export type HardwareKind = "kds" | "checkout" | "customerStatus" | "paymentTerminal" | "kitchenPrinter";

export type HardwareSlot = { enabled: boolean; quantity: number };
export type HardwareConfig = Record<HardwareKind, HardwareSlot>;

export type WorkspaceDeploymentInput = {
  planId: WorkspacePlanId;
  hardware: HardwareConfig;
};

export type DeploymentPlanCard = {
  id: WorkspacePlanId;
  name: string;
  priceLabel: string;
  trialLabel: string;
  locationSummary: string;
  included: string[];
  bestFor: string;
  recommended: boolean;
  defaultHardware: HardwareConfig;
};

export type DeploymentHardwareItem = {
  id: HardwareKind;
  label: string;
  description: string;
  addonMonthlyLabel: string;
};

export type DeploymentCatalog = {
  ok: boolean;
  platformIncludes?: string[];
  plans?: DeploymentPlanCard[];
  hardware?: DeploymentHardwareItem[];
  error?: string;
};

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

export type WorkspaceDeploymentRecord = WorkspaceDeploymentInput & {
  confirmedAt: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  planName?: string;
  totalMonthlyOre: number;
  trialDays: number;
  currency: "SEK";
  welcomeShownAt?: string | null;
  dismissedNoticeIds?: string[];
};

export type TrialNoticeHelpPointer = {
  label: string;
  anchor: string;
};

export type TrialNoticePayload = {
  id: string;
  kind: "welcome" | "reminder";
  title: string;
  message: string;
  planName: string;
  companyName: string;
  trialStartedAt: string;
  trialEndsAt: string;
  trialDays: number;
  daysRemaining: number;
  hoursRemaining: number;
  dismissLabel: string;
  helpPointers: TrialNoticeHelpPointer[];
};

async function deploymentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  return data as T;
}

export async function fetchDeploymentCatalog(): Promise<DeploymentCatalog> {
  return deploymentFetch<DeploymentCatalog>("/workspace-deployment/catalog");
}

export async function quoteWorkspaceDeployment(input: WorkspaceDeploymentInput): Promise<{
  ok: boolean;
  quote?: DeploymentQuote;
  error?: string;
}> {
  return deploymentFetch("/workspace-deployment/quote", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchWorkspaceDeploymentStatus(token: string): Promise<{
  ok: boolean;
  hasDeployment?: boolean;
  deployment?: WorkspaceDeploymentRecord | null;
  error?: string;
}> {
  return deploymentFetch("/workspace-deployment/status", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchOwnerTrialNotice(token: string): Promise<{
  ok: boolean;
  notice?: TrialNoticePayload | null;
  error?: string;
}> {
  return deploymentFetch("/workspace-deployment/trial-notice", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function dismissOwnerTrialNotice(
  token: string,
  noticeId: string
): Promise<{
  ok: boolean;
  nextNotice?: TrialNoticePayload | null;
  error?: string;
}> {
  return deploymentFetch("/workspace-deployment/trial-notice/dismiss", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ noticeId })
  });
}

export async function confirmWorkspaceDeployment(
  token: string,
  input: WorkspaceDeploymentInput
): Promise<{
  ok: boolean;
  deployment?: WorkspaceDeploymentRecord;
  quote?: DeploymentQuote;
  error?: string;
}> {
  return deploymentFetch("/workspace-deployment/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export function formatOreMonthly(ore: number): string {
  const kr = Math.round(ore / 100);
  return `${kr.toLocaleString("sv-SE")} kr/month`;
}

export function cloneHardwareConfig(config: HardwareConfig): HardwareConfig {
  return {
    kds: { ...config.kds },
    checkout: { ...config.checkout },
    customerStatus: { ...config.customerStatus },
    paymentTerminal: { ...config.paymentTerminal },
    kitchenPrinter: { ...config.kitchenPrinter }
  };
}
