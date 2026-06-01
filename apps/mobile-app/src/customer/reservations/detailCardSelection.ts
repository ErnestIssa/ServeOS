/** Shared helpers for portrait detail-card carousels (step 1 experience, step 2 accessibility). */

export type DetailCardOption = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly bullets: readonly string[];
};

export function toggleDetailCardId(ids: string[], option: DetailCardOption): string[] {
  if (ids.includes(option.id)) return ids.filter((id) => id !== option.id);
  return [...ids, option.id];
}

export function detailCardRecapLabels(
  ids: string[],
  options: readonly DetailCardOption[],
  excludeIds: readonly string[] = []
): string[] {
  const skip = new Set(excludeIds);
  return ids
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is DetailCardOption => Boolean(o))
    .filter((o) => !skip.has(o.id))
    .map((o) => o.label);
}

export function firstDetailCardScrollIndex(
  ids: string[],
  options: readonly DetailCardOption[]
): number | null {
  if (ids.length === 0) return null;
  for (let i = 0; i < options.length; i++) {
    if (ids.includes(options[i]!.id)) return i;
  }
  return null;
}
