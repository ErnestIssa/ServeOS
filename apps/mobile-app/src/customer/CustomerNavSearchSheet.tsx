import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { menuImageSourceForKey } from "../menu/menuCardAssets";
import type { MenuCategoryLite, MenuItemFlat } from "../menu/menuBrowseUtils";
import { R } from "../theme";
import { SwapColorSpinner } from "../components/SwapColorLoader";
import { appendNavSearchRecent, loadNavSearchRecent } from "./navSearchRecentStorage";
import {
  bestDrinksItems,
  fastestPrepareItems,
  filterPoolByCategory,
  menuPoolFromCategories,
  popularTonightItems,
  quickSuggestionQueries,
  relatedItemsForQuery,
  searchItems,
  staffPickItems
} from "./searchSheetModel";

type Props = {
  restaurantId: string;
  categories: MenuCategoryLite[];
  money: (cents: number) => string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddItem: (item: MenuItemFlat) => void;
  addingItemIds?: Record<string, boolean>;
};

type SectionId = "tonight" | "staff" | "fast" | "drinks" | "related";

type SheetSection = {
  id: SectionId;
  title: string;
  subtitle?: string;
  data: MenuItemFlat[];
};

function SearchResultRow({
  item,
  money,
  onAdd,
  addLoading,
  addedJustNow,
  subline
}: {
  item: MenuItemFlat;
  money: (cents: number) => string;
  onAdd: () => void;
  addLoading?: boolean;
  addedJustNow?: boolean;
  subline?: string;
}) {
  const line = subline ?? item.categoryName;
  return (
    <View style={styles.resultRow}>
      <Image source={menuImageSourceForKey(item.id)} style={styles.resultImg} resizeMode="cover" />
      <View style={styles.resultMid}>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.resultSub} numberOfLines={1}>
          {line}
          {item.description?.trim() ? ` · ${item.description.trim()}` : ""}
        </Text>
        <Text style={styles.resultPrice}>{money(item.priceCents)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addedJustNow ? `${item.name} added` : `Add ${item.name}`}
        onPress={onAdd}
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        disabled={!!addLoading}
      >
        {addLoading ? (
          <SwapColorSpinner size={18} stroke={2} />
        ) : addedJustNow ? (
          <Text style={styles.addBtnCheck}>✓</Text>
        ) : (
          <Text style={styles.addBtnText}>+</Text>
        )}
      </Pressable>
    </View>
  );
}

export function CustomerNavSearchSheet({
  restaurantId,
  categories,
  money,
  searchQuery,
  onSearchChange,
  onAddItem,
  addingItemIds
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [openSections, setOpenSections] = React.useState<Record<SectionId, boolean>>({
    tonight: true,
    staff: true,
    fast: true,
    drinks: true,
    related: true
  });

  /** Sticky ✓ after a successful add so users can scan what they already tapped. Cleared when this sheet instance unmounts. */
  const [addedConfirmById, setAddedConfirmById] = React.useState<Record<string, boolean>>({});
  const prevAddingRef = React.useRef<Record<string, boolean>>({});

  const pool = React.useMemo(() => menuPoolFromCategories(categories), [categories]);
  const filteredPool = React.useMemo(() => filterPoolByCategory(pool, categoryId), [pool, categoryId]);
  const quickChips = React.useMemo(() => quickSuggestionQueries(pool), [pool]);
  const categoryPills = React.useMemo(() => {
    const rows = (categories ?? [])
      .filter((c) => (c.items?.length ?? 0) > 0)
      .slice(0, 10)
      .map((c) => ({ id: c.id, name: c.name }));
    return rows;
  }, [categories]);

  const q = searchQuery.trim();
  const primaryHits = React.useMemo(() => searchItems(filteredPool, q), [filteredPool, q]);
  const relatedHits = React.useMemo(
    () => relatedItemsForQuery(filteredPool, primaryHits, q, 12),
    [filteredPool, primaryHits, q]
  );

  const discoverTonight = React.useMemo(() => popularTonightItems(pool, restaurantId), [pool, restaurantId]);
  const discoverStaff = React.useMemo(() => staffPickItems(pool, restaurantId), [pool, restaurantId]);
  const discoverFast = React.useMemo(() => fastestPrepareItems(pool), [pool]);
  const discoverDrinks = React.useMemo(() => bestDrinksItems(pool), [pool]);

  React.useEffect(() => {
    const prev = prevAddingRef.current;
    const next = addingItemIds ?? {};

    for (const [id, wasLoading] of Object.entries(prev)) {
      if (!wasLoading) continue;
      if (next[id]) continue; // still loading

      setAddedConfirmById((p) => ({ ...p, [id]: true }));
    }

    prevAddingRef.current = next;
  }, [addingItemIds]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await loadNavSearchRecent();
      if (!cancelled) setRecent(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushRecent = React.useCallback(async (term: string) => {
    await appendNavSearchRecent(term);
    setRecent(await loadNavSearchRecent());
  }, []);

  const onChipPress = (label: string) => {
    onSearchChange(label);
    void pushRecent(label);
  };

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sections: SheetSection[] = React.useMemo(() => {
    if (!q) {
      return [
        {
          id: "tonight",
          title: "🔥 Most ordered tonight",
          subtitle: "Top picks guests love right now",
          data: openSections.tonight ? discoverTonight : []
        },
        {
          id: "staff",
          title: "⭐ Staff picks",
          subtitle: "Curated from tonight's menu",
          data: openSections.staff ? discoverStaff : []
        },
        {
          id: "fast",
          title: "🕒 Fastest to prepare",
          subtitle: "Great when you're in a hurry",
          data: openSections.fast ? discoverFast : []
        },
        {
          id: "drinks",
          title: "🥤 Best drinks",
          subtitle: "Pair with your meal",
          data: openSections.drinks ? discoverDrinks : []
        }
      ];
    }

    const out: SheetSection[] = [
      {
        id: "tonight",
        title: `Results · ${primaryHits.length} match${primaryHits.length === 1 ? "" : "es"}`,
        subtitle: relatedHits.length ? `${relatedHits.length} related` : undefined,
        data: primaryHits
      }
    ];

    if (relatedHits.length) {
      out.push({
        id: "related",
        title: "Goes well with that",
        subtitle: "Sides, drinks & combos from your menu",
        data: openSections.related ? relatedHits : []
      });
    }

    return out;
  }, [
    q,
    openSections.tonight,
    openSections.staff,
    openSections.fast,
    openSections.drinks,
    openSections.related,
    discoverTonight,
    discoverStaff,
    discoverFast,
    discoverDrinks,
    primaryHits,
    relatedHits
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <SectionList
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 18 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
        sections={sections}
        keyExtractor={(it) => it.id}
        renderItem={({ item, section }) => (
          <SearchResultRow
            item={item}
            money={money}
            onAdd={() => onAddItem(item)}
            addLoading={!!addingItemIds?.[item.id]}
            addedJustNow={!!addedConfirmById[item.id]}
            subline={
              section.id === "tonight"
                ? !q
                  ? `Popular · ${item.categoryName}`
                  : undefined
                : section.id === "staff"
                  ? `Staff pick · ${item.categoryName}`
                  : section.id === "fast"
                    ? `Quick · ${item.categoryName}`
                    : section.id === "drinks"
                      ? `Drink · ${item.categoryName}`
                      : section.id === "related"
                        ? `Related · ${item.categoryName}`
                        : undefined
            }
          />
        )}
        renderSectionHeader={({ section }) => {
          const isCollapsible = !q || section.id === "related";
          const isOpen = openSections[section.id];

          return (
            <View style={styles.sectionStickyWrap}>
              <Pressable
                onPress={isCollapsible ? () => toggleSection(section.id) : undefined}
                disabled={!isCollapsible}
                style={({ pressed }) => [styles.sectionHeadRow, pressed && isCollapsible && styles.sectionHeadPressed]}
                accessibilityRole={isCollapsible ? "button" : undefined}
                accessibilityLabel={
                  isCollapsible ? (isOpen ? `Collapse ${section.title}` : `Expand ${section.title}`) : section.title
                }
              >
                <View style={styles.sectionHeadCopy}>
                  <Text style={styles.sectionEmojiTitle}>{section.title}</Text>
                  {section.subtitle && (!isCollapsible || isOpen) ? <Text style={styles.sectionSub}>{section.subtitle}</Text> : null}
                </View>
                {isCollapsible ? (
                  <Text style={[styles.sectionChevron, isOpen && styles.sectionChevronOpen]}>›</Text>
                ) : null}
              </Pressable>
            </View>
          );
        }}
        ListHeaderComponent={
          !q ? (
            <View>
              <Text style={styles.sectionLabel}>Popular searches</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {quickChips.map((label) => (
                  <Pressable
                    key={label}
                    onPress={() => onChipPress(label)}
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                  >
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
                {recent
                  .filter((r) => !quickChips.some((c) => c.toLowerCase() === r.toLowerCase()))
                  .map((label) => (
                    <Pressable
                      key={`r-${label}`}
                      onPress={() => onChipPress(label)}
                      style={({ pressed }) => [styles.chipMuted, pressed && styles.chipPressed]}
                    >
                      <Text style={styles.chipMutedText}>{label}</Text>
                    </Pressable>
                  ))}
              </ScrollView>

              {categoryPills.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, styles.mtMd]}>Categories</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {categoryPills.map((c) => {
                      const active = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setCategoryId(active ? null : c.id)}
                          style={({ pressed }) => [
                            styles.catPill,
                            active && styles.catPillActive,
                            pressed && styles.chipPressed
                          ]}
                        >
                          <Text style={[styles.catPillText, active && styles.catPillTextActive]} numberOfLines={1}>
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              {categoryId ? (
                <Text style={styles.filterNotice} numberOfLines={2}>
                  Showing {categoryPills.find((c) => c.id === categoryId)?.name ?? "category"} only · Tap again to clear
                </Text>
              ) : null}
            </View>
          ) : primaryHits.length === 0 ? (
            <View style={[styles.emptyHints, { maxWidth: windowW - 32 }]}>
              <Text style={styles.emptyTitle}>No exact matches</Text>
              <Text style={styles.emptyBody}>Try a category chip above or a shorter search — we&apos;ll show related dishes next.</Text>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 120,
    backgroundColor: "rgba(255,255,255,0.94)"
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: R.space.sm
  },
  sectionStickyWrap: {
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingTop: 12
  },
  sectionLabel: {
    fontSize: R.type.label,
    fontWeight: "900",
    color: R.text,
    letterSpacing: 0.15,
    marginBottom: 10
  },
  sectionEmojiTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: R.text,
    letterSpacing: -0.2
  },
  sectionSub: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.textMuted,
    lineHeight: 17
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeadCopy: {
    flex: 1,
    minWidth: 0
  },
  sectionChevron: {
    fontSize: 26,
    fontWeight: "800",
    color: R.accentPurple,
    marginTop: -2,
    transform: [{ rotate: "0deg" }]
  },
  sectionChevronOpen: {
    transform: [{ rotate: "90deg" }]
  },
  sectionHeadPressed: { opacity: 0.88 },
  mtMd: { marginTop: 18 },
  mtLg: { marginTop: 22 },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)"
  },
  chipPressed: { opacity: 0.88 },
  chipText: { fontSize: 14, fontWeight: "800", color: R.accentPurple },
  chipMuted: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: R.radius.pill,
    backgroundColor: R.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: R.border
  },
  chipMutedText: { fontSize: 14, fontWeight: "700", color: R.textSecondary },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.radius.pill,
    backgroundColor: R.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: R.border,
    maxWidth: 220
  },
  catPillActive: {
    backgroundColor: "rgba(139,92,246,0.14)",
    borderColor: R.accentPurple
  },
  catPillText: { fontSize: 13, fontWeight: "800", color: R.text },
  catPillTextActive: { color: R.accentPurple },
  filterNotice: {
    marginTop: 10,
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.ordersNavPurple
  },
  sectionBlock: {
    marginTop: 22,
    paddingTop: 4,
    paddingBottom: 8
  },
  resultsMeta: {
    fontSize: R.type.caption,
    fontWeight: "700",
    color: R.textMuted,
    marginBottom: 12
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: R.border
  },
  resultImg: {
    width: 58,
    height: 58,
    borderRadius: R.radius.tile,
    backgroundColor: R.bgSubtle
  },
  resultMid: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10
  },
  resultTitle: {
    fontSize: R.type.body,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.2
  },
  resultSub: {
    marginTop: 3,
    fontSize: R.type.caption,
    fontWeight: "600",
    color: R.textSecondary,
    lineHeight: 16
  },
  resultPrice: {
    marginTop: 6,
    fontSize: R.type.label,
    fontWeight: "900",
    color: R.text
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: R.accentPurple,
    ...Platform.select({
      ios: {
        shadowColor: "#4c1d95",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6
      },
      android: { elevation: 3 },
      default: {}
    })
  },
  addBtnPressed: { opacity: 0.9 },
  addBtnText: { fontSize: 26, fontWeight: "400", color: "#fff", marginTop: -2 },
  addBtnCheck: { fontSize: 20, fontWeight: "900", color: "#fff" },
  emptyHints: {
    marginTop: 28,
    padding: R.space.md,
    borderRadius: R.radius.card,
    backgroundColor: R.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: R.border
  },
  emptyTitle: { fontSize: R.type.label, fontWeight: "900", color: R.text },
  emptyBody: { marginTop: 8, fontSize: R.type.body, fontWeight: "600", color: R.textSecondary, lineHeight: 22 },
});
