/**
 * Cloudflare CDN cache layer in front of S3.
 * API token is used ONLY for cache purge after uploads — not DNS or domain management.
 *
 * Flow: ServeOS upload → AWS S3 → Cloudflare purge → users see fresh content.
 */

const CF_API = "https://api.cloudflare.com/client/v4";
const MAX_FILES_PER_PURGE = 30;

export function cloudflareApiToken(): string | undefined {
  return process.env.CLOUDFLARE_API_TOKEN?.trim();
}

/** Zone ID for cache purge API only (not DNS management). */
export function cloudflareZoneId(): string | undefined {
  return process.env.CLOUDFLARE_ZONE_ID?.trim();
}

export function cloudflareCdnBaseUrl(): string | undefined {
  return process.env.CLOUDFLARE_CDN_URL?.trim();
}

export function isCloudflareCdnConfigured(): boolean {
  return Boolean(cloudflareApiToken() && cloudflareZoneId() && cloudflareCdnBaseUrl());
}

export function cdnUrlForObjectKey(objectKey: string): string | null {
  const base = cloudflareCdnBaseUrl();
  if (!base) return null;
  const key = objectKey.replace(/^\//, "");
  return `${base.replace(/\/$/, "")}/${key}`;
}

export type PurgeResult = { ok: true; purged: number } | { ok: false; error: string };

export async function purgeCdnUrls(urls: string[]): Promise<PurgeResult> {
  if (!isCloudflareCdnConfigured()) {
    return { ok: false, error: "cloudflare_cdn_not_configured" };
  }

  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return { ok: true, purged: 0 };

  const token = cloudflareApiToken()!;
  const zoneId = cloudflareZoneId()!;
  let purged = 0;

  for (let i = 0; i < unique.length; i += MAX_FILES_PER_PURGE) {
    const batch = unique.slice(i, i + MAX_FILES_PER_PURGE);
    const res = await fetch(`${CF_API}/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ files: batch })
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
    };

    if (!res.ok || !data.success) {
      const msg = data.errors?.[0]?.message ?? `cloudflare_http_${res.status}`;
      return { ok: false, error: msg };
    }
    purged += batch.length;
  }

  return { ok: true, purged };
}

export async function purgeCdnObjectKeys(objectKeys: string[]): Promise<PurgeResult> {
  if (!isCloudflareCdnConfigured()) return { ok: true, purged: 0 };
  const urls = objectKeys
    .map((k) => cdnUrlForObjectKey(k))
    .filter((u): u is string => Boolean(u));
  return purgeCdnUrls(urls);
}

/** Best-effort purge after S3 writes — never fails uploads. */
export function scheduleCdnPurgeForObjectKeys(objectKeys: string[]): void {
  if (!isCloudflareCdnConfigured()) return;
  const keys = objectKeys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return;
  void purgeCdnObjectKeys(keys).catch((err) => {
    console.warn("[cloudflare-cdn] purge failed", err instanceof Error ? err.message : err);
  });
}
