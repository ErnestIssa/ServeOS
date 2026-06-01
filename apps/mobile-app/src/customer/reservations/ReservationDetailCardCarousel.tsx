import * as Haptics from "expo-haptics";
import React from "react";
import {
  FlatList,
  LayoutChangeEvent,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { firstDetailCardScrollIndex, type DetailCardOption } from "./detailCardSelection";
import { resolveSnapCarouselIndex } from "./reservationSnapCarousel";

/** Portrait card: height > width (standing rectangle). */
const CARD_WIDTH_RATIO = 0.56;
const CARD_MIN_W = 196;
const CARD_MAX_W = 236;
const CARD_ASPECT = 1.68;

type Props = {
  options: readonly DetailCardOption[];
  selectedIds: string[];
  onSelect: (option: DetailCardOption) => void;
};

export function ReservationDetailCardCarousel({ options, selectedIds, onSelect }: Props) {
  const { colors: t, isDark } = useAppTheme();
  const listRef = React.useRef<FlatList<DetailCardOption>>(null);
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  const [pageW, setPageW] = React.useState(0);
  const [viewIndex, setViewIndex] = React.useState(0);
  const hapticIndexRef = React.useRef(0);
  const isProgrammaticRef = React.useRef(false);
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const syncedScrollIndexRef = React.useRef<number | null>(null);

  const selectedIndex = firstDetailCardScrollIndex(selectedIds, options);
  const cardW =
    pageW > 0 ? Math.round(Math.min(CARD_MAX_W, Math.max(CARD_MIN_W, pageW * CARD_WIDTH_RATIO))) : CARD_MIN_W;
  const cardH = Math.round(cardW * CARD_ASPECT);
  const pageH = cardH + 12;

  const idleBg = isDark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.94)";
  const idleBorder = isDark ? "rgba(148,163,184,0.26)" : "rgba(226,232,240,0.94)";
  const purple = t.ordersNavPurpleBright;

  const emitSelection = React.useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt) return;
      onSelectRef.current(opt);
    },
    [options]
  );

  const scrollToPage = React.useCallback(
    (index: number, animated: boolean) => {
      if (pageW <= 0) return;
      const clamped = Math.max(0, Math.min(options.length - 1, index));
      isProgrammaticRef.current = true;
      hapticIndexRef.current = clamped;
      listRef.current?.scrollToOffset({ offset: clamped * pageW, animated });
      setViewIndex((prev) => (prev === clamped ? prev : clamped));
      syncedScrollIndexRef.current = clamped;
      if (!animated) {
        isProgrammaticRef.current = false;
        return;
      }
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 400);
    },
    [options.length, pageW]
  );

  React.useEffect(() => {
    if (pageW <= 0 || selectedIndex == null) return;
    if (syncedScrollIndexRef.current === selectedIndex) return;
    scrollToPage(selectedIndex, false);
  }, [pageW, selectedIndex, scrollToPage]);

  const onListLayout = React.useCallback((e: LayoutChangeEvent) => {
    const w = PixelRatio.roundToNearestPixel(e.nativeEvent.layout.width);
    if (w > 0) setPageW((prev) => (prev === w ? prev : w));
  }, []);

  const onScrollLive = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticRef.current || pageW <= 0) return;
      const idx = resolveSnapCarouselIndex(e.nativeEvent.contentOffset.x, 0, pageW, options.length);
      if (idx !== hapticIndexRef.current) {
        hapticIndexRef.current = idx;
        void Haptics.selectionAsync();
      }
      setViewIndex((prev) => (prev === idx ? prev : idx));
    },
    [options.length, pageW]
  );

  const onScrollSettled = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticRef.current) {
        isProgrammaticRef.current = false;
        return;
      }
      if (pageW <= 0) return;
      const { contentOffset, velocity } = e.nativeEvent;
      const nearest = resolveSnapCarouselIndex(
        contentOffset.x,
        velocity?.x ?? 0,
        pageW,
        options.length
      );
      hapticIndexRef.current = nearest;
      syncedScrollIndexRef.current = nearest;
      setViewIndex((prev) => (prev === nearest ? prev : nearest));
    },
    [options.length, pageW]
  );

  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<DetailCardOption>) => {
      const selected = selectedIdSet.has(item.id);
      return (
        <View style={[styles.page, { width: pageW, height: pageH }]}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              emitSelection(index);
            }}
            style={({ pressed }) => [
              styles.cardPress,
              { width: cardW, height: cardH },
              pressed && styles.cardPressOn
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={item.title}
          >
            <View
              style={[
                styles.card,
                selected && styles.cardSelected,
                {
                  borderColor: selected ? purple : idleBorder,
                  backgroundColor: selected ? purple : idleBg
                }
              ]}
            >
              {selected && Platform.OS !== "web" ? (
                <View style={styles.selectedWhiteRing} pointerEvents="none" />
              ) : null}
              <Text style={[styles.cardTitle, { color: selected ? "#FFFFFF" : t.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.bulletList}>
                {item.bullets.map((line) => (
                  <View key={line} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: selected ? "#FFFFFF" : t.ordersNavPurpleBright }]}>
                      •
                    </Text>
                    <Text
                      style={[
                        styles.bulletText,
                        { color: selected ? "rgba(255,255,255,0.9)" : t.textSecondary }
                      ]}
                    >
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Pressable>
        </View>
      );
    },
    [cardH, cardW, emitSelection, idleBg, idleBorder, pageH, pageW, purple, selectedIdSet, t.ordersNavPurpleBright, t.text, t.textSecondary]
  );

  return (
    <View style={styles.wrap} onLayout={onListLayout}>
      {pageW > 0 ? (
        <FlatList
          ref={listRef}
          data={[...options]}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={{ height: pageH }}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          directionalLockEnabled
          pagingEnabled
          decelerationRate="fast"
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          onScroll={onScrollLive}
          onScrollEndDrag={onScrollSettled}
          onMomentumScrollEnd={onScrollSettled}
          getItemLayout={(_, i) => ({
            length: pageW,
            offset: pageW * i,
            index: i
          })}
        />
      ) : (
        <View style={{ height: pageH }} />
      )}
      <View style={styles.dotsRow}>
        {options.map((opt, i) => (
          <View
            key={opt.id}
            style={[
              styles.dot,
              i === viewIndex && [styles.dotActive, { backgroundColor: t.ordersNavPurpleBright }]
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginTop: 4,
    marginBottom: 4
  },
  page: {
    alignItems: "center",
    justifyContent: "center"
  },
  cardPress: {
    alignItems: "center",
    justifyContent: "center"
  },
  cardPressOn: {
    opacity: 0.96
  },
  card: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: "flex-start",
    overflow: "hidden",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#1e1b4b",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.11,
        shadowRadius: 18
      },
      android: { elevation: 5 },
      default: {}
    })
  },
  cardSelected: Platform.select({
    ios: {
      shadowColor: "#7C3AED",
      shadowOpacity: 0.28,
      shadowRadius: 22
    },
    android: { elevation: 8 },
    default: {}
  }),
  selectedWhiteRing: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.28,
    lineHeight: 20,
    marginBottom: 14
  },
  bulletList: { gap: 9, flex: 1 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
    marginTop: 1
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(148,163,184,0.45)"
  },
  dotActive: {
    width: 16,
    borderRadius: 4
  }
});
