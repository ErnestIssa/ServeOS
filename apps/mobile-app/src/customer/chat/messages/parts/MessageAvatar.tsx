import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useChatTheme } from "../../useChatTheme";

type Props = {
  uri?: string | null;
  initial: string;
  mine?: boolean;
  online?: boolean;
  size?: number;
};

export const MessageAvatar = React.memo(function MessageAvatar({
  uri,
  initial,
  mine,
  online,
  size = 30
}: Props) {
  const { tokens, colors: t } = useChatTheme();
  const ring = mine ? tokens.brandSoft : t.border;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ring,
            backgroundColor: mine ? tokens.brandSoft : t.bgSubtle
          }
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
            accessibilityLabel="Avatar"
          />
        ) : (
          <Text style={[styles.initial, { color: mine ? tokens.brand : t.textSecondary, fontSize: size * 0.38 }]}>
            {initial}
          </Text>
        )}
      </View>
      {online != null ? (
        <View
          style={[
            styles.presence,
            {
              backgroundColor: online ? t.success : t.textMuted,
              borderColor: t.bg
            }
          ]}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5
  },
  initial: { fontWeight: "900" },
  presence: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2
  }
});
