import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDisplayMoney } from "../../formatMoney";
import { useAppTheme } from "../../theme/AppThemeContext";
import { patchMenuItemActive } from "../../mobile/workspaceApi";

type Props = {
  authToken: string;
  restaurantId: string;
  categories: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; name: string; priceCents: number; isActive: boolean; description?: string | null }>;
  }>;
  canEdit: boolean;
  onReload: () => void;
};

export function AdminMenuView(props: Props) {
  const { colors: t } = useAppTheme();
  const [openCat, setOpenCat] = React.useState<string | null>(props.categories[0]?.id ?? null);
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        cat: {
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.border,
          marginBottom: 8,
          backgroundColor: t.bgElevated
        },
        catActive: { borderColor: t.accentPurple },
        item: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border
        },
        toggle: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: t.accentPurple
        },
        off: { backgroundColor: t.textMuted }
      }),
    [t]
  );

  const cat = props.categories.find((c) => c.id === openCat);

  return (
    <>
      {props.categories.map((c) => (
        <Pressable
          key={c.id}
          style={[styles.cat, openCat === c.id && styles.catActive]}
          onPress={() => setOpenCat(c.id)}
        >
          <Text style={{ fontWeight: "800", color: t.text }}>{c.name}</Text>
          <Text style={{ color: t.textMuted, fontSize: 12 }}>{c.items.length} items</Text>
        </Pressable>
      ))}
      {cat ? (
        <View style={[styles.cat, { marginTop: 8 }]}>
          {cat.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontWeight: "700", color: item.isActive ? t.text : t.textMuted }}>{item.name}</Text>
                <Text style={{ color: t.textSecondary, fontSize: 13 }}>{formatDisplayMoney(item.priceCents)}</Text>
              </View>
              {props.canEdit ? (
                <Pressable
                  style={[styles.toggle, !item.isActive && styles.off]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void patchMenuItemActive(
                      props.authToken,
                      props.restaurantId,
                      item.id,
                      !item.isActive
                    ).then(() => props.onReload());
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                    {item.isActive ? "Available" : "Off"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}
