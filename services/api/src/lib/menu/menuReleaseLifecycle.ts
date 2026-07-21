import type { MenuStatus } from "@prisma/client";

/** Guest-facing release lifecycle — independent from availability orderability. */
export type MenuReleaseState = "draft" | "scheduled" | "live" | "retired" | "archived";

export type MenuReleaseStateInput = {
  status: MenuStatus;
  scheduledPublishAt?: Date | string | null;
  scheduledRetireAt?: Date | string | null;
  /** Alias for scheduledRetireAt (DB column scheduledUnpublishAt). */
  scheduledUnpublishAt?: Date | string | null;
  hasUnpublishedChanges?: boolean;
  now?: Date;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Authoritative release-state derivation (SSOT for admin badges).
 * Availability (hours/stock/channels) is evaluated separately.
 */
export function deriveMenuReleaseState(input: MenuReleaseStateInput): {
  releaseState: MenuReleaseState;
  releaseLabel: string;
  scheduledPublishAt: string | null;
  scheduledRetireAt: string | null;
} {
  const now = input.now ?? new Date();
  const publishAt = toDate(input.scheduledPublishAt);
  const retireAt = toDate(input.scheduledRetireAt ?? input.scheduledUnpublishAt);

  if (input.status === "ARCHIVED") {
    return {
      releaseState: "archived",
      releaseLabel: "Archived",
      scheduledPublishAt: publishAt?.toISOString() ?? null,
      scheduledRetireAt: retireAt?.toISOString() ?? null
    };
  }

  if (input.status === "RETIRED") {
    return {
      releaseState: "retired",
      releaseLabel: "Retired",
      scheduledPublishAt: publishAt?.toISOString() ?? null,
      scheduledRetireAt: retireAt?.toISOString() ?? null
    };
  }

  if (input.status === "PUBLISHED") {
    return {
      releaseState: "live",
      releaseLabel: input.hasUnpublishedChanges ? "Live · draft changes" : "Live",
      scheduledPublishAt: publishAt?.toISOString() ?? null,
      scheduledRetireAt: retireAt?.toISOString() ?? null
    };
  }

  // DRAFT
  if (publishAt && publishAt.getTime() > now.getTime()) {
    return {
      releaseState: "scheduled",
      releaseLabel: "Scheduled",
      scheduledPublishAt: publishAt.toISOString(),
      scheduledRetireAt: retireAt?.toISOString() ?? null
    };
  }

  return {
    releaseState: "draft",
    releaseLabel: "Draft",
    scheduledPublishAt: publishAt?.toISOString() ?? null,
    scheduledRetireAt: retireAt?.toISOString() ?? null
  };
}

export function formatReleaseWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
