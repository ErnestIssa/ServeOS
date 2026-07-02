import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import { R } from "../theme";

type Props = {
  title: string;
  description?: string | null;
  priceLabel: string;
  image: ImageSourcePropType | null;
  layout: "carousel" | "grid";
  carouselWidth?: number;
  gridCardWidth?: number;
  liked?: boolean;
  onToggleLike?: () => void;
  onAddPress: () => void;
  onOpenDetail?: () => void;
  addLoading?: boolean;
  /** Sticky ✓ after a successful add (matches nav search sheet). */
  addedJustNow?: boolean;
};

export function MenuItemCard({
  title,
  description,
  priceLabel,
  image,
  layout,
  carouselWidth,
  gridCardWidth,
  liked,
  onToggleLike,
  onAddPress,
  onOpenDetail,
  addLoading = false,
  addedJustNow = false
}: Props) {
  const carousel = layout === "carousel";
  const desc = description?.trim();
  const widthStyle = carousel && carouselWidth ? { width: carouselWidth } : layout === "grid" && gridCardWidth ? { width: gridCardWidth } : undefined;

  return (
    <View style={[styles.shell, carousel ? styles.shellCarousel : styles.shellGrid, widthStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${title}`}
        onPress={onOpenDetail ?? onAddPress}
      >
        {image ? (
          <Image source={image} style={[styles.image, carousel ? styles.imageCarousel : styles.imageGrid]} resizeMode="cover" />
        ) : (
          <View style={[styles.image, carousel ? styles.imageCarousel : styles.imageGrid, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>No photo</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {onToggleLike ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? "Remove from saved" : "Save item"}
              hitSlop={12}
              onPress={onToggleLike}
              style={styles.heartTap}
            >
              <Text style={styles.heart}>{liked ? "♥" : "♡"}</Text>
            </Pressable>
          ) : null}
        </View>
        {desc ? (
          <Text style={styles.desc} numberOfLines={carousel ? 2 : 3}>
            {desc}
          </Text>
        ) : (
          <View style={{ height: 4 }} />
        )}
        <View style={styles.footer}>
          <Text style={styles.price}>{priceLabel}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addedJustNow ? `${title} added` : `Add ${title}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            android_ripple={{ color: "rgba(99,102,241,0.15)" }}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addPressed]}
            disabled={addLoading && !addedJustNow}
            onPress={onAddPress}
          >
            {addedJustNow || addLoading ? (
              <Text style={[styles.addBtnCheck, addLoading && !addedJustNow && { opacity: 0.62 }]}>✓</Text>
            ) : (
              <Text style={styles.addBtnText}>+</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: R.radius.tile,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 5 }
    })
  },

  shellCarousel: { minHeight: 246 },

  shellGrid: {
    marginBottom: R.space.sm
  },

  image: {
    width: "100%",
    backgroundColor: R.bgSubtle
  },

  imageCarousel: { height: 118 },

  imageGrid: { height: 128 },

  imagePlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: R.bgSubtle },

  imagePlaceholderText: { fontSize: 11, fontWeight: "700", color: R.textMuted },

  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    flexGrow: 1
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6
  },

  title: {
    flex: 1,
    fontSize: R.type.label + 1,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.15
  },

  heartTap: {
    paddingLeft: 4,
    paddingTop: 2
  },

  heart: {
    fontSize: 17,
    color: R.accentPurple,
    fontWeight: "700"
  },

  desc: {
    marginTop: 4,
    fontSize: R.type.caption,
    color: R.textSecondary,
    lineHeight: 17
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: R.space.xs
  },

  price: {
    fontSize: R.type.body,
    fontWeight: "800",
    color: R.text
  },

  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: R.accentPurple,
    alignItems: "center",
    justifyContent: "center"
  },

  addPressed: { opacity: 0.86 },

  addBtnText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: -2
  },

  addBtnCheck: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900"
  }
});
