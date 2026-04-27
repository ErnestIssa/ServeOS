import { getUpstashRedis } from "@serveos/core-upstash";

export type CompanyLookupResult =
  | {
      success: true;
      found: true;
      data: {
        companyName?: string;
        address?: string;
        postalCode?: string;
        city?: string;
        legalForm?: string;
        status?: string;
        vatNumber?: string;
        source?: string;
      };
    }
  | { success: true; found: false }
  | { success: false; message: string };

export function sanitizeSwedishOrgNumber(
  inputRaw: string
): { ok: true; org10: string } | { ok: false; message: string } {
  const raw = (inputRaw ?? "").trim();
  if (!raw) return { ok: false, message: "org_number_required" };
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return { ok: true, org10: digits };
  if (digits.length === 12) {
    // Sometimes provided with century prefix (YYYYMMDDXXXX or YYMMDDXXXX). Keep last 10 digits.
    return { ok: true, org10: digits.slice(-10) };
  }
  return { ok: false, message: "invalid_org_number" };
}

async function rateLimitOrgLookup(org10: string): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const r = getUpstashRedis();
  if (!r) return { ok: true };

  // Simple IP-less limit: per-org, per-minute.
  const key = `ratelimit:org-lookup:${org10}`;
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, 60);
  }
  const limit = Number(process.env.COMPANY_LOOKUP_RATELIMIT_PER_MINUTE ?? 10);
  if (count > limit) return { ok: false, retryAfterSec: 60 };
  return { ok: true };
}

async function getCached(org10: string): Promise<CompanyLookupResult | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const key = `org:${org10}`;
  const v = await r.get<string>(key);
  if (!v) return null;
  try {
    return JSON.parse(v) as CompanyLookupResult;
  } catch {
    return null;
  }
}

async function setCached(org10: string, value: CompanyLookupResult): Promise<void> {
  const r = getUpstashRedis();
  if (!r) return;
  const key = `org:${org10}`;
  const ex = Number(process.env.COMPANY_LOOKUP_CACHE_TTL_SEC ?? 60 * 60 * 24);
  await r.set(key, JSON.stringify(value), { ex });
}

type ProviderResponse = {
  companyName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  legalForm?: string;
  status?: string;
  vatNumber?: string;
};

async function lookupWithPrimaryProvider(org10: string, timeoutMs: number): Promise<ProviderResponse | null> {
  // MVP Sweden provider (external supplier).
  // Can be swapped later without changing the frontend.
  const base =
    process.env.SWEDISH_COMPANY_LOOKUP_URL?.trim() ||
    "https://mackan.eu/tools/bolagsverket/get_data.php";

  const url = `${base}${base.includes("?") ? "&" : "?"}orgnr=${encodeURIComponent(org10)}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as any;

    const org = Array.isArray(j?.organisationer) ? j.organisationer[0] : null;
    if (!org || typeof org !== "object") return null;

    const name = org?.organisationsnamn?.organisationsnamnLista?.[0]?.namn;
    const post = org?.postadressOrganisation?.postadress;
    const legalForm = org?.organisationsform?.klartext ?? org?.juridiskForm?.klartext;
    const active = org?.verksamOrganisation?.kod;

    if (!name || typeof name !== "string") {
      // Provider uses `fel.typ === ORGANISATION_FINNS_EJ` for not-found.
      return null;
    }

    return {
      companyName: name,
      address: post?.utdelningsadress ?? undefined,
      postalCode: post?.postnummer ?? undefined,
      city: post?.postort ?? undefined,
      legalForm: legalForm ?? undefined,
      status: active === "JA" ? "Active" : active ? String(active) : undefined
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function lookupWithFallbackProvider(_org10: string, _timeoutMs: number): Promise<ProviderResponse | null> {
  // Placeholder for future provider upgrades (Bolagsverket official, UC, Creditsafe, D&B, etc).
  return null;
}

export async function lookupSwedishCompanyByOrgNumber(
  orgNumberRaw: string
): Promise<
  | { kind: "invalid"; message: string }
  | { kind: "rate_limited"; retryAfterSec: number }
  | { kind: "result"; result: CompanyLookupResult }
> {
  const sanitized = sanitizeSwedishOrgNumber(orgNumberRaw);
  if (!sanitized.ok) return { kind: "invalid", message: sanitized.message };
  const { org10 } = sanitized;

  const rl = await rateLimitOrgLookup(org10);
  if (!rl.ok) return { kind: "rate_limited", retryAfterSec: rl.retryAfterSec };

  const cached = await getCached(org10);
  if (cached) return { kind: "result", result: cached };

  const timeoutMs = Number(process.env.COMPANY_LOOKUP_TIMEOUT_MS ?? 3500);
  const provider = (await lookupWithPrimaryProvider(org10, timeoutMs)) ?? (await lookupWithFallbackProvider(org10, timeoutMs));
  if (!provider || !provider.companyName) {
    const notFound: CompanyLookupResult = { success: true, found: false };
    return { kind: "result", result: notFound };
  }

  const ok: CompanyLookupResult = {
    success: true,
    found: true,
    data: {
      companyName: provider.companyName,
      address: provider.address,
      postalCode: provider.postalCode,
      city: provider.city,
      legalForm: provider.legalForm,
      status: provider.status,
      vatNumber: provider.vatNumber,
      source: "provider"
    }
  };
  // Cache successful lookups (per product spec).
  await setCached(org10, ok);
  return { kind: "result", result: ok };
}

