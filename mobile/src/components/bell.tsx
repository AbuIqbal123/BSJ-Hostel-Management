import { Feather } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHallColors } from "@/theme/colors";

/** The Home bell, top right, with the unread count. 99+ keeps the badge one width. */
export function Bell({ count, href }: { count: number; href: Href }) {
  const colors = useHallColors();
  const label = count > 99 ? "99+" : String(count);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} new` : "Notifications"}
      hitSlop={12}
      onPress={() => router.push(href)}
      style={[styles.bell, { backgroundColor: colors.ink }]}
    >
      <Feather name="bell" size={16} color={colors.paper} />
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.forest, borderColor: colors.paper }]}>
          <Text numberOfLines={1} style={[styles.count, { color: "#FFFFFF" }]}>
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { fontFamily: "SourceSans3_600SemiBold", fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] },
});
