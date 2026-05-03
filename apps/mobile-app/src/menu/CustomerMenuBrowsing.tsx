import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, useWindowDimensions, View, type ViewabilityConfig } from "react-native";
import { R } from "../theme";
import { MenuItemCard } from "./MenuItemCard";
import { MenuCardScrollReveal } from "./MenuCardScrollReveal";
import { menuImageSourceForKey } from "./menuCardAssets";
import { appendLastOrdered, getRestaurantPrefs, toggleLike } from "./menuPreferencesStorage";
import {
  buildFilteredMenuPool,
  clusterCategoriesForBrowse,
  filterMenuItems,
  type MenuCategoryLite,
  type MenuItemFlat,
  idsToItems,
  rankedBySeed
} from "./menuBrowseUtils";
import { menuRowsSignature, useMenuRevealDelays } from "./useMenuRevealDelays";

const VIEW_CFG: ViewabilityConfig = { minimumViewTime: 0, itemVisiblePercentThreshold: 14 };
/** Pixel space between two grid columns (not a StyleSheet key — do not use `gutterStyle`). */
const MENU_GRID_INTERCOLUMN_PX = 10;

function MenuCarouselStrip({
  trackingKey,
  headingTitle,
  headingSub,
  items,
  carouselCardW,
  carouselContentStyle,
  copyInset,
  money,
  likedOrder,
  onToggleLike,
  onAddItem
}: {
  trackingKey: string;
  headingTitle: string;
  headingSub: string;
  items: MenuItemFlat[];
  carouselCardW: number;
  carouselContentStyle: object;
  copyInset: object | null | undefined;
  money: (cents: number) => string;
  likedOrder: string[];
  onToggleLike: (id: string) => void;
  onAddItem: (item: MenuItemFlat) => void;
}) {
  const rowsSig = useMemo(() => menuRowsSignature(items), [items]);
  const { delayById, onViewableItemsChanged } = useMenuRevealDelays(rowsSig);
  const likedKey = likedOrder.join(",");

  if (items.length === 0) return null;

  return (
    <View style={styles.sectionBlock}>
      <View style={[styles.sectionHead, copyInset]}>
        <Text style={styles.sectionTitle}>{headingTitle}</Text>
        <Text style={styles.sectionSub}>{headingSub}</Text>
      </View>
      <FlatList
        key={trackingKey}
        horizontal
        data={items}
        extraData={[delayById, likedKey]}
        keyExtractor={(it) => `${trackingKey}-${it.id}`}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        nestedScrollEnabled
        removeClippedSubviews={false}
        viewabilityConfig={VIEW_CFG}
        onViewableItemsChanged={onViewableItemsChanged}
        contentContainerStyle={carouselContentStyle}
        style={[styles.carouselList, styles.carouselListAlign]}
        {...(Platform.OS === "android" ? { fadingEdgeLength: 0 } : {})}
        renderItem={({ item, index }) => (
          <MenuCardScrollReveal
            delayMs={delayById[item.id]}
            style={{ width: carouselCardW, marginRight: index === items.length - 1 ? 0 : 12 }}
          >
            <MenuItemCard
              layout="carousel"
              carouselWidth={carouselCardW}
              title={item.name}
              description={item.description}
              priceLabel={money(item.priceCents)}
              image={menuImageSourceForKey(item.id)}
              liked={likedOrder.includes(item.id)}
              onToggleLike={() => onToggleLike(item.id)}
              onAddPress={() => onAddItem(item)}
            />
          </MenuCardScrollReveal>
        )}
      />
    </View>
  );
}

function MenuGridChunk({
  trackingKey,
  items,
  gridCardWidth,
  listWidth,
  money,
  likedOrder,
  onToggleLike,
  onAddItem
}: {
  trackingKey: string;
  items: MenuItemFlat[];
  gridCardWidth: number;
  listWidth: number;
  money: (cents: number) => string;
  likedOrder: string[];
  onToggleLike: (id: string) => void;
  onAddItem: (item: MenuItemFlat) => void;
}) {
  const rowsSig = useMemo(() => menuRowsSignature(items), [items]);
  const { delayById, onViewableItemsChanged } = useMenuRevealDelays(rowsSig);
  const likedKey = likedOrder.join(",");

  if (items.length === 0) return null;

  return (
    <FlatList
      key={trackingKey}
      data={items}
      numColumns={2}
      scrollEnabled={false}
      nestedScrollEnabled
      removeClippedSubviews={false}
      extraData={[delayById, likedKey]}
      style={{ width: listWidth, alignSelf: "stretch" }}
      contentContainerStyle={styles.gridFlatContent}
      keyExtractor={(it) => `${trackingKey}-${it.id}`}
      viewabilityConfig={VIEW_CFG}
      onViewableItemsChanged={onViewableItemsChanged}
      columnWrapperStyle={styles.gridColumnWrap}
      renderItem={({ item }) => (
        <MenuCardScrollReveal delayMs={delayById[item.id]} style={{ width: gridCardWidth }}>
          <MenuItemCard
            layout="grid"
            gridCardWidth={gridCardWidth}
            title={item.name}
            description={item.description}
            priceLabel={money(item.priceCents)}
            image={menuImageSourceForKey(item.id)}
            liked={likedOrder.includes(item.id)}
            onToggleLike={() => onToggleLike(item.id)}
            onAddPress={() => onAddItem(item)}
          />
        </MenuCardScrollReveal>
      )}
    />
  );
}

type MenuPreview = {
  ok: true;
  restaurant: { id: string; name: string };
  categories: MenuCategoryLite[];
};

type Props = {
  menuPreview: MenuPreview;
  money: (cents: number) => string;
  restaurantId: string;
  filterQuery?: string;
  onAddItem: (item: MenuItemFlat) => void;
  likedIdsInitial?: string[];
  prefsVersion?: number;
  edgeToEdge?: boolean;
};

export function CustomerMenuBrowsing({
  menuPreview,
  money,
  restaurantId,
  filterQuery = "",
  onAddItem,
  likedIdsInitial,
  prefsVersion = 0,
  edgeToEdge = false
}: Props) {
  const { width: winW } = useWindowDimensions();
  const pad = R.space.sm * 2;
  const inner = Math.max(280, winW - pad);
  const usableW = edgeToEdge ? winW : inner;
  const gridCardWidth = (usableW - MENU_GRID_INTERCOLUMN_PX) / 2;
  const carouselCardW = Math.min(210, Math.max(158, Math.round(usableW * 0.48)));
  const copyInset = edgeToEdge ? styles.copyInset : null;
  const carouselContentStyle = edgeToEdge ? styles.carouselContentBleed : styles.carouselContent;

  const cats = menuPreview.categories ?? [];

  /** Full menu (no search) — rails + Saved resolve likes against this so hearts always match dishes */
  const poolFull = useMemo(
    () => buildFilteredMenuPool(cats as MenuCategoryLite[], ""),
    [cats]
  );

  const pool = useMemo(
    () => buildFilteredMenuPool(cats as MenuCategoryLite[], filterQuery),
    [cats, filterQuery]
  );

  const [likedOrder, setLikedOrder] = useState<string[]>(() => likedIdsInitial ?? []);
  const [lastOrdered, setLastOrdered] = useState<string[]>([]);
  /** Invalidates in-flight prefs reads so a slow initial fetch cannot overwrite likes after a heart tap */
  const prefsFetchGen = useRef(0);

  useEffect(() => {
    const fetchId = ++prefsFetchGen.current;
    let cancelled = false;
    void (async () => {
      const p = await getRestaurantPrefs(restaurantId);
      if (cancelled || fetchId !== prefsFetchGen.current) return;
      setLikedOrder(p.likes);
      setLastOrdered(p.lastOrdered);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, prefsVersion]);

  const clustered = useMemo(() => clusterCategoriesForBrowse(cats as MenuCategoryLite[]), [cats]);

  /** Lanes and categories with ≥1 item after search filter — hide empty aisles/categories entirely */
  const browseLanes = useMemo(() => {
    const lanes: Array<{
      aisle: string;
      categoriesWithItems: Array<{ cat: MenuCategoryLite; items: MenuItemFlat[] }>;
    }> = [];

    for (const { aisle, categories: catsInLane } of clustered) {
      const categoriesWithItems = catsInLane
        .map((cat) => {
          const items = filterMenuItems(
            (cat.items ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              priceCents: item.priceCents ?? 0,
              categoryId: cat.id,
              categoryName: cat.name
            })),
            filterQuery
          );
          return { cat, items };
        })
        .filter((row) => row.items.length > 0);

      if (categoriesWithItems.length > 0) {
        lanes.push({ aisle, categoriesWithItems });
      }
    }

    return lanes;
  }, [clustered, filterQuery]);

  const recommended = useMemo(
    () => rankedBySeed(pool, "serveos_pick_rec_v3").slice(0, Math.min(pool.length, 12)),
    [pool]
  );

  const popular = useMemo(() => rankedBySeed(pool, "serveos_pick_hot_v2").slice(0, Math.min(pool.length, 12)), [pool]);

  const orderAgain = useMemo(() => idsToItems(lastOrdered, pool), [lastOrdered, pool]);

  /** Storage order (newest first) × full menu, then search filter */
  const saved = useMemo(() => {
    if (likedOrder.length === 0) return [];
    const resolved = idsToItems(likedOrder, poolFull);
    return filterMenuItems(resolved, filterQuery);
  }, [likedOrder, poolFull, filterQuery]);

  const handleLike = useCallback(async (itemId: string) => {
    await toggleLike(restaurantId, itemId);
    prefsFetchGen.current += 1;
    const p = await getRestaurantPrefs(restaurantId);
    setLikedOrder(p.likes);
  }, [restaurantId]);

  const stripProps = {
    carouselCardW,
    carouselContentStyle,
    copyInset,
    money,
    likedOrder,
    onToggleLike: (id: string) => {
      void handleLike(id);
    },
    onAddItem
  };

  /** Venue has no dishes at all */
  if (poolFull.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.venueRow, copyInset]}>
        <Text style={styles.venueName}>{menuPreview.restaurant.name}</Text>
        <Text style={styles.venueHint}>Swipe for ideas · tap + to add</Text>
      </View>

      {recommended.length > 0 ? (
        <MenuCarouselStrip
          trackingKey="rec"
          headingTitle="Recommended for you"
          headingSub="Based on what's popular today"
          items={recommended}
          {...stripProps}
        />
      ) : null}
      {popular.length > 0 ? (
        <MenuCarouselStrip
          trackingKey="hot"
          headingTitle="Popular right now"
          headingSub="Quick picks from the pass"
          items={popular}
          {...stripProps}
        />
      ) : null}
      {orderAgain.length > 0 ? (
        <MenuCarouselStrip
          trackingKey="again"
          headingTitle="Order again"
          headingSub="From your last visits at this venue"
          items={orderAgain}
          {...stripProps}
        />
      ) : null}
      {saved.length > 0 ? (
        <MenuCarouselStrip
          trackingKey="saved"
          headingTitle="Saved"
          headingSub="Items you've hearted"
          items={saved}
          {...stripProps}
        />
      ) : null}

      {browseLanes.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={[styles.sectionHead, copyInset]}>
            <Text style={styles.sectionTitle}>Browse by category</Text>
            <Text style={styles.sectionSub}>Sorted by meal type, food lane, then menu category</Text>
          </View>

          {browseLanes.map(({ aisle, categoriesWithItems }) => (
            <View key={aisle} style={styles.aisleBlock}>
              <View style={[styles.aislePillRow, copyInset]}>
                <View style={styles.aislePill}>
                  <Text style={styles.aislePillText}>{aisle}</Text>
                </View>
              </View>

              {categoriesWithItems.map(({ cat, items }) =>
                items.length === 0 ? null : (
                  <View key={cat.id} style={styles.categoryBlock}>
                    <View style={copyInset}>
                      <Text style={styles.categoryTitle}>{cat.name}</Text>
                      <Text style={styles.categoryLane}>{aisle}</Text>
                    </View>
                    <MenuGridChunk
                      trackingKey={`${aisle}-${cat.id}`}
                      items={items}
                      gridCardWidth={gridCardWidth}
                      listWidth={usableW}
                      money={money}
                    likedOrder={likedOrder}
                    onToggleLike={(id) => void handleLike(id)}
                      onAddItem={onAddItem}
                    />
                  </View>
                )
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function recordOrderedItemsForRestaurant(restaurantId: string, menuItemIds: string[]): Promise<void> {
  return appendLastOrdered(restaurantId, menuItemIds);
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: R.space.md
  },

  venueRow: {
    marginBottom: R.space.md
  },

  venueName: {
    fontSize: R.type.title,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.3
  },

  venueHint: {
    marginTop: 4,
    fontSize: R.type.caption,
    color: R.textSecondary,
    fontWeight: "600"
  },

  sectionBlock: {
    marginBottom: R.space.lg
  },

  sectionHead: {
    marginBottom: R.space.sm
  },

  sectionTitle: {
    fontSize: R.type.title - 1,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.2
  },

  sectionSub: {
    marginTop: 4,
    fontSize: R.type.caption,
    color: R.textSecondary,
    fontWeight: "500",
    lineHeight: 18
  },

  copyInset: {
    paddingHorizontal: R.space.sm
  },

  carouselContent: {
    paddingRight: R.space.sm,
    gap: 12,
    flexGrow: 0,
    justifyContent: "flex-start",
    alignItems: "flex-start"
  },

  carouselContentBleed: {
    paddingLeft: 0,
    paddingRight: 0,
    gap: 12,
    flexGrow: 0,
    justifyContent: "flex-start",
    alignItems: "flex-start"
  },

  carouselList: {},
  /** Horizontal rails pack from LTR; avoids single-card rows visually hugging the trailing edge */
  carouselListAlign: {
    alignSelf: "flex-start",
    width: "100%"
  },

  gridFlatContent: {
    alignItems: "flex-start",
    width: "100%"
  },

  /** Left-align every row (single-card rows no longer sit on the right with numColumns={2}) */
  gridColumnWrap: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: MENU_GRID_INTERCOLUMN_PX
  },

  aisleBlock: {
    marginBottom: R.space.md
  },

  aislePillRow: {
    marginBottom: R.space.xs
  },

  aislePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(139,92,246,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.radius.pill
  },

  aislePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: R.accentPurple,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },

  categoryBlock: {
    marginBottom: R.space.md
  },

  categoryTitle: {
    fontSize: R.type.label,
    fontWeight: "800",
    color: R.text
  },

  categoryLane: {
    marginTop: 2,
    fontSize: R.type.caption,
    color: R.textMuted,
    fontWeight: "600",
    marginBottom: R.space.sm
  }
});
