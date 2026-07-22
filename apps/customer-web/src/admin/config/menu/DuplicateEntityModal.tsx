import { useEffect, useMemo, useState } from "react";
import {
  duplicateCategory,
  duplicateMenuItem,
  duplicateModifierGroup,
  duplicateModifierOption,
  duplicateRestaurantMenu,
  duplicateRestaurantMenuToLocation,
  getReplicationJob,
  type MenuSurfaceRow,
  type ReplicationJobRow
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { ProfileToggleRow } from "../../profile/ProfileUi";
import {
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote
} from "./menuPageModalShell";

export type DuplicateEntityKind = "menu" | "category" | "item" | "modifier_group" | "modifier_option";

export type DuplicateDestinationOption = {
  id: string;
  label: string;
  hint?: string;
};

type Props = {
  open: boolean;
  kind: DuplicateEntityKind;
  sourceId: string;
  sourceName: string;
  token: string;
  restaurantId: string;
  suggestedName?: string;
  destinations?: DuplicateDestinationOption[];
  /** Cross-location venues for menu duplicate-to. */
  locationDestinations?: DuplicateDestinationOption[];
  defaultDestinationId?: string | null;
  allowChangeDestination?: boolean;
  onClose: () => void;
  onDuplicated: (result: {
    kind: DuplicateEntityKind;
    id: string;
    name: string;
    menu?: MenuSurfaceRow;
  }) => void;
};

function defaultCopyName(name: string) {
  const root = name.replace(/\s*\(Copy(?:\s+\d+)?\)\s*$/i, "").trim() || name.trim();
  return `${root} (Copy)`;
}

function countsLine(job: ReplicationJobRow | null) {
  const counts = (job?.counts ?? null) as {
    categories?: { done: number; total: number };
    items?: { done: number; total: number };
    media?: { done: number; total: number };
  } | null;
  if (!counts) return null;
  const parts: string[] = [];
  if (counts.categories) parts.push(`Categories ${counts.categories.done}/${counts.categories.total}`);
  if (counts.items) parts.push(`Items ${counts.items.done}/${counts.items.total}`);
  if (counts.media) parts.push(`Media ${counts.media.done}/${counts.media.total}`);
  return parts.length ? parts.join(" · ") : null;
}

export function DuplicateEntityModal({
  open,
  kind,
  sourceId,
  sourceName,
  token,
  restaurantId,
  suggestedName,
  destinations = [],
  locationDestinations = [],
  defaultDestinationId = null,
  allowChangeDestination = false,
  onClose,
  onDuplicated
}: Props) {
  const [name, setName] = useState("");
  const [destinationId, setDestinationId] = useState<string>("");
  const [locationMode, setLocationMode] = useState<"same" | "other">("same");
  const [targetLocationId, setTargetLocationId] = useState("");
  const [copyCategories, setCopyCategories] = useState(true);
  const [copyItems, setCopyItems] = useState(true);
  const [copyModifiers, setCopyModifiers] = useState(true);
  const [copyMedia, setCopyMedia] = useState(true);
  const [copyAvailability, setCopyAvailability] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ReplicationJobRow | null>(null);

  const title = useMemo(() => {
    switch (kind) {
      case "menu":
        return locationMode === "other" ? "Duplicate menu to location" : "Duplicate menu";
      case "category":
        return allowChangeDestination ? "Duplicate category to…" : "Duplicate category";
      case "item":
        return allowChangeDestination ? "Duplicate item to…" : "Duplicate item";
      case "modifier_group":
        return "Duplicate modifier group";
      case "modifier_option":
        return "Duplicate modifier option";
    }
  }, [kind, allowChangeDestination, locationMode]);

  const confirmLabel = kind === "menu" ? (job ? "Working…" : "Create draft") : "Create copy";
  const jobRunning = Boolean(job && (job.status === "QUEUED" || job.status === "RUNNING"));

  useEffect(() => {
    if (!open) return;
    setName((suggestedName ?? defaultCopyName(sourceName)).trim());
    setDestinationId(defaultDestinationId ?? destinations[0]?.id ?? "");
    setLocationMode("same");
    setTargetLocationId(locationDestinations[0]?.id ?? "");
    setCopyCategories(true);
    setCopyItems(true);
    setCopyModifiers(true);
    setCopyMedia(true);
    setCopyAvailability(true);
    setBusy(false);
    setError(null);
    setJob(null);
  }, [open, sourceId, sourceName, suggestedName, defaultDestinationId, destinations, locationDestinations]);

  useEffect(() => {
    if (!open || !job || (job.status !== "QUEUED" && job.status !== "RUNNING")) return;
    let cancelled = false;
    const poll = async () => {
      const res = await getReplicationJob(token, restaurantId, job.id);
      if (cancelled || !res.ok || !res.job) return;
      setJob(res.job);
      if (res.job.status === "COMPLETED") {
        setBusy(false);
        const result = res.job.result;
        const newId = result?.newMenuId ?? "";
        const newName = result?.name ?? name;
        onDuplicated({ kind, id: newId, name: newName });
        onClose();
        return;
      }
      if (res.job.status === "FAILED" || res.job.status === "CANCELLED") {
        setBusy(false);
        setError(res.job.error ?? "Duplication failed. Partial copies were rolled back.");
      }
    };
    const timer = window.setInterval(() => void poll(), 1200);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, job?.id, job?.status, token, restaurantId, kind, name, onDuplicated, onClose]);

  const destinationOptions = useMemo(
    () =>
      destinations.map((d) => ({
        value: d.id,
        label: d.hint ? `${d.label} — ${d.hint}` : d.label
      })),
    [destinations]
  );

  const locationOptions = useMemo(
    () =>
      locationDestinations.map((d) => ({
        value: d.id,
        label: d.hint ? `${d.label} — ${d.hint}` : d.label
      })),
    [locationDestinations]
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }
    if (allowChangeDestination && (kind === "category" || kind === "item") && !destinationId) {
      setError(kind === "category" ? "Choose a destination menu." : "Choose a destination category.");
      return;
    }
    if (kind === "menu" && locationMode === "other" && !targetLocationId) {
      setError("Choose a destination location.");
      return;
    }

    setBusy(true);
    setError(null);

    if (kind === "menu") {
      const options = {
        name: trimmed,
        copyCategories,
        copyMedia,
        copyAvailability
      };
      const res =
        locationMode === "other"
          ? await duplicateRestaurantMenuToLocation(token, restaurantId, sourceId, {
              ...options,
              targetRestaurantId: targetLocationId
            })
          : await duplicateRestaurantMenu(token, restaurantId, sourceId, options);

      if (!res.ok || !res.jobId) {
        setBusy(false);
        setError(res.message ?? res.error ?? "Could not start menu duplication.");
        return;
      }
      setJob({
        id: res.jobId,
        kind: locationMode === "other" ? "DUPLICATE_TO_LOCATION" : "DUPLICATE_MENU",
        status: "QUEUED",
        sourceRestaurantId: restaurantId,
        targetRestaurantId: locationMode === "other" ? targetLocationId : restaurantId,
        progressPct: 0,
        phase: "queued",
        counts: null,
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null
      });
      return;
    }

    if (kind === "category") {
      const res = await duplicateCategory(token, restaurantId, sourceId, {
        name: trimmed,
        targetMenuId: allowChangeDestination ? destinationId : undefined,
        copyItems,
        copyMedia
      });
      setBusy(false);
      if (!res.ok || !res.category) {
        setError(res.message ?? res.error ?? "Could not duplicate category.");
        return;
      }
      onDuplicated({ kind, id: res.category.id, name: res.category.name });
      onClose();
      return;
    }

    if (kind === "item") {
      const res = await duplicateMenuItem(token, restaurantId, sourceId, {
        name: trimmed,
        targetCategoryId: allowChangeDestination ? destinationId : undefined,
        copyModifiers,
        copyMedia
      });
      setBusy(false);
      if (!res.ok || !res.item) {
        setError(res.message ?? res.error ?? "Could not duplicate item.");
        return;
      }
      onDuplicated({ kind, id: res.item.id, name: res.item.name });
      onClose();
      return;
    }

    if (kind === "modifier_group") {
      const res = await duplicateModifierGroup(token, restaurantId, sourceId, { name: trimmed });
      setBusy(false);
      if (!res.ok || !res.group) {
        setError(res.message ?? res.error ?? "Could not duplicate modifier group.");
        return;
      }
      onDuplicated({ kind, id: res.group.id, name: res.group.name });
      onClose();
      return;
    }

    const res = await duplicateModifierOption(token, restaurantId, sourceId, { name: trimmed });
    setBusy(false);
    if (!res.ok || !res.option) {
      setError(res.message ?? res.error ?? "Could not duplicate modifier option.");
      return;
    }
    onDuplicated({ kind, id: res.option.id, name: res.option.name });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy || jobRunning ? () => undefined : onClose}
      title={title}
      description={
        jobRunning
          ? "Duplicating in the background — you can keep this open to watch progress."
          : `Create an independent draft copy of “${sourceName}”.`
      }
      titleId={`duplicate-${kind}-title`}
      stackLevel="overlay"
    >
      {jobRunning || (job && job.status === "FAILED") ? (
        <div className="mb-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm font-medium admin-config-text">
            {job?.status === "FAILED" ? "Duplication failed" : `Duplicating… ${job?.progressPct ?? 0}%`}
          </p>
          {job?.phase ? (
            <p className="mt-1 text-xs admin-config-text-muted capitalize">{job.phase.replace(/_/g, " ")}</p>
          ) : null}
          {countsLine(job) ? (
            <p className="mt-2 text-xs admin-config-text-subtle">{countsLine(job)}</p>
          ) : null}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-slate-800 transition-all dark:bg-slate-200"
              style={{ width: `${Math.max(2, job?.progressPct ?? 0)}%` }}
            />
          </div>
        </div>
      ) : null}

      {!jobRunning ? (
        <>
          <AdminLabel>
            New name
            <AdminInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              disabled={busy}
            />
          </AdminLabel>

          {kind === "menu" && locationDestinations.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              <AdminBubbleDropdown
                label="Destination venue"
                value={locationMode === "same" ? "__same__" : targetLocationId}
                options={[
                  { value: "__same__", label: "This location" },
                  ...locationOptions
                ]}
                onChange={(v) => {
                  if (v === "__same__") {
                    setLocationMode("same");
                  } else {
                    setLocationMode("other");
                    setTargetLocationId(v);
                  }
                }}
                disabled={busy}
                containWithinModal
                dropInline
              />
            </div>
          ) : null}

          {allowChangeDestination && (kind === "category" || kind === "item") ? (
            <div className="mt-3">
              {destinationOptions.length > 0 ? (
                <AdminBubbleDropdown
                  label="Destination"
                  value={destinationId}
                  options={destinationOptions}
                  onChange={setDestinationId}
                  disabled={busy}
                  containWithinModal
                  dropInline
                />
              ) : (
                <ProfileModalNote>No destinations available.</ProfileModalNote>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2">
            {kind === "menu" ? (
              <>
                <ProfileToggleRow
                  label="Copy categories & items"
                  hint="Includes modifier groups and options."
                  checked={copyCategories}
                  onChange={setCopyCategories}
                  disabled={busy}
                />
                <ProfileToggleRow
                  label="Copy media references"
                  hint="Same image files — no extra storage."
                  checked={copyMedia}
                  onChange={setCopyMedia}
                  disabled={busy}
                />
                <ProfileToggleRow
                  label="Copy availability"
                  hint="Schedule windows for the new draft menu."
                  checked={copyAvailability}
                  onChange={setCopyAvailability}
                  disabled={busy}
                />
              </>
            ) : null}
            {kind === "category" ? (
              <>
                <ProfileToggleRow
                  label="Copy items"
                  hint="Includes modifiers on each item."
                  checked={copyItems}
                  onChange={setCopyItems}
                  disabled={busy}
                />
                <ProfileToggleRow
                  label="Copy media references"
                  hint="Same image files — no extra storage."
                  checked={copyMedia}
                  onChange={setCopyMedia}
                  disabled={busy}
                />
              </>
            ) : null}
            {kind === "item" ? (
              <>
                <ProfileToggleRow
                  label="Copy modifiers"
                  hint="Modifier groups and options."
                  checked={copyModifiers}
                  onChange={setCopyModifiers}
                  disabled={busy}
                />
                <ProfileToggleRow
                  label="Copy media references"
                  hint="Same image files — no extra storage."
                  checked={copyMedia}
                  onChange={setCopyMedia}
                  disabled={busy}
                />
              </>
            ) : null}
          </div>

          {kind === "menu" ? (
            <ProfileModalNote>
              Runs in the background as a replication job. Publish history and live versions are not copied.
            </ProfileModalNote>
          ) : null}
        </>
      ) : null}

      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      {!jobRunning ? (
        <ProfileModalFooter
          onCancel={onClose}
          onConfirm={() => void submit()}
          confirmLabel={busy ? "Starting…" : confirmLabel}
          busy={busy}
          confirmDisabled={busy || name.trim().length < 2}
        />
      ) : (
        <ProfileModalNote>Keep this open to see progress. The draft appears when the job completes.</ProfileModalNote>
      )}
    </MenuPageModalShell>
  );
}
