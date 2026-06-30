import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { R } from "../theme";
import type { MenuItemFlat } from "./menuBrowseUtils";
import { menuImageSourceForItem, menuImagesForItem, menuVideosForItem } from "./menuMediaUtils";

type Props = {
  visible: boolean;
  item: MenuItemFlat | null;
  money: (cents: number) => string;
  onClose: () => void;
  onAddToCart: (item: MenuItemFlat, modifierOptionIds?: string[]) => void;
  adding?: boolean;
};

export function MenuItemDetailSheet({ visible, item, money, onClose, onAddToCart, adding }: Props) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});
  const galleryRef = useRef<FlatList>(null);
  const width = Dimensions.get("window").width;

  const images = useMemo(() => (item ? menuImagesForItem(item) : []), [item]);
  const videos = useMemo(() => (item ? menuVideosForItem(item) : []), [item]);
  const cover = item ? menuImageSourceForItem(item) : null;
  const gallery = images.length > 0 ? images : cover ? [{ id: "cover", kind: "image" as const, url: (cover as { uri: string }).uri, sortOrder: 0 }] : [];

  useEffect(() => {
    if (!item) return;
    const initial: Record<string, string[]> = {};
    for (const g of item.modifierGroups ?? []) {
      if (g.minSelect > 0 && g.options[0]) initial[g.id] = [g.options[0].id];
      else initial[g.id] = [];
    }
    setModifierSelections(initial);
  }, [item?.id]);

  const modifierIds = useMemo(() => Object.values(modifierSelections).flat(), [modifierSelections]);

  const toggleModifier = (groupId: string, optionId: string, maxSelect: number) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect <= 1) return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const handleAdd = () => {
    if (!item) return;
    for (const g of item.modifierGroups ?? []) {
      const picked = modifierSelections[g.id]?.length ?? 0;
      if (picked < g.minSelect) return;
    }
    onAddToCart(item, modifierIds);
  };

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {gallery.length > 0 ? (
            <View>
              <FlatList
                ref={galleryRef}
                horizontal
                pagingEnabled
                data={gallery}
                keyExtractor={(m) => m.id}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setGalleryIndex(idx);
                }}
                renderItem={({ item: media }) => (
                  <Image source={{ uri: media.url! }} style={[styles.hero, { width }]} resizeMode="cover" />
                )}
              />
              {gallery.length > 1 ? (
                <Text style={styles.galleryHint}>
                  {galleryIndex + 1} / {gallery.length}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={[styles.hero, styles.heroPlaceholder, { width }]}>
              <Text style={styles.heroPlaceholderText}>No photos yet</Text>
            </View>
          )}

          <View style={styles.body}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.price}>{money(item.priceCents)}</Text>
            {item.categoryName ? <Text style={styles.category}>{item.categoryName}</Text> : null}
            {item.description?.trim() ? <Text style={styles.description}>{item.description.trim()}</Text> : null}

            {videos.length > 0 ? (
              <View style={styles.videoBlock}>
                <Text style={styles.sectionLabel}>Short videos</Text>
                {videos.map((v) => (
                  <View key={v.id} style={styles.videoCard}>
                    <Text style={styles.videoMeta}>
                      {v.durationMs ? `${Math.round(v.durationMs / 1000)}s` : "Video"} — open in browser to play
                    </Text>
                    {v.url ? <Text style={styles.videoUrl} numberOfLines={1}>{v.url}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {item.modifierGroups && item.modifierGroups.length > 0 ? (
              <View style={styles.modBlock}>
                <Text style={styles.sectionLabel}>Customize</Text>
                {item.modifierGroups.map((g) => (
                  <View key={g.id} style={styles.modGroup}>
                    <Text style={styles.modGroupName}>
                      {g.name}
                      {g.minSelect > 0 ? ` · pick ${g.minSelect}` : ""}
                    </Text>
                    {g.options.filter((o) => o.isActive).map((o) => {
                      const picked = modifierSelections[g.id]?.includes(o.id);
                      return (
                        <Pressable
                          key={o.id}
                          style={[styles.modOptionRow, picked && styles.modOptionRowOn]}
                          onPress={() => toggleModifier(g.id, o.id, g.maxSelect)}
                        >
                          <Text style={[styles.modOption, picked && styles.modOptionOn]}>
                            {o.name}
                            {o.priceDeltaCents ? ` (+${money(o.priceDeltaCents)})` : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
          <Pressable
            style={[styles.addBtn, adding && styles.addBtnDisabled]}
            disabled={adding}
            onPress={handleAdd}
          >
            <Text style={styles.addBtnText}>{adding ? "Adding…" : "Add to cart"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: R.bg },
  scroll: { paddingBottom: 100 },
  hero: { height: 280, backgroundColor: R.bgSubtle },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroPlaceholderText: { color: R.textMuted, fontWeight: "600" },
  galleryHint: {
    position: "absolute",
    right: 16,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700"
  },
  body: { padding: R.space.md, gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: R.text },
  price: { fontSize: 18, fontWeight: "700", color: R.accentPurple },
  category: { fontSize: 13, fontWeight: "600", color: R.textMuted },
  description: { fontSize: 15, lineHeight: 22, color: R.textSecondary, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: R.textMuted, marginTop: 12 },
  videoBlock: { gap: 8 },
  videoCard: { padding: 12, borderRadius: 12, backgroundColor: R.bgElevated, borderWidth: 1, borderColor: R.border },
  videoMeta: { fontWeight: "700", color: R.text },
  videoUrl: { fontSize: 11, color: R.textMuted, marginTop: 4 },
  modBlock: { gap: 6 },
  modGroup: { marginTop: 6 },
  modGroupName: { fontWeight: "700", color: R.text },
  modOptionRow: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: R.border,
    backgroundColor: R.bgElevated
  },
  modOptionRowOn: { borderColor: R.accentPurple, backgroundColor: "rgba(124,58,237,0.12)" },
  modOption: { fontSize: 14, color: R.textSecondary },
  modOptionOn: { color: R.text, fontWeight: "700" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    padding: R.space.md,
    borderTopWidth: 1,
    borderTopColor: R.border,
    backgroundColor: R.bg
  },
  closeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: R.border
  },
  closeBtnText: { fontWeight: "700", color: R.text },
  addBtn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: R.accentPurple
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { fontWeight: "800", color: "#fff" }
});
