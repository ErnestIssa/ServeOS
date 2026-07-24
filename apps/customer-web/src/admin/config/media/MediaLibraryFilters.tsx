import { useMemo } from "react";
import type { MediaCollectionRow, MediaLibraryListQuery } from "../../../api";
import { MenuListSearchField } from "../menu/MenuPageUi";
import {
  applyMediaFiltersToQuery,
  buildMediaListQueryPreset,
  MEDIA_DEFAULT_SORT,
  mediaFiltersFromQuery
} from "./mediaListQuery";

type Props = {
  query: MediaLibraryListQuery;
  collections: MediaCollectionRow[];
  total: number;
  onChange: (q: MediaLibraryListQuery) => void;
};

export function MediaLibraryFilters({ query, collections, total, onChange }: Props) {
  const preset = useMemo(() => buildMediaListQueryPreset(collections), [collections]);
  const activeFilters = useMemo(() => mediaFiltersFromQuery(query), [query]);
  const activeSort = query.sort ?? MEDIA_DEFAULT_SORT;

  return (
    <MenuListSearchField
      value={query.q ?? ""}
      onChange={(value) => onChange({ ...query, q: value, page: 1 })}
      placeholder="Search name, alt text, or tags…"
      aria-label="Search media library"
      filterGroups={preset.filterGroups}
      sortOptions={preset.sortOptions}
      activeFilters={activeFilters}
      activeSort={activeSort}
      defaultSort={preset.defaultSort}
      resultCount={total}
      totalCount={total}
      onFiltersChange={(ids) => onChange(applyMediaFiltersToQuery(query, ids))}
      onSortChange={(id) => onChange({ ...query, sort: id, page: 1 })}
      filterTitle="Filter media"
      filterSubtitle="Narrow the library using live asset data."
      sortTitle="Sort media"
      sortSubtitle="Changes apply to the library instantly."
    />
  );
}
