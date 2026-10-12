import { Feather } from "@expo/vector-icons";
import type { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHallColors } from "@/theme/colors";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export function TabIcon({
  name,
  color,
}: {
  name: "home" | "calendar" | "settings" | "inbox";
  color: ColorValue;
}) {
  return <Feather name={name} size={24} color={color} />;
}

export function QrMark({ color }: { color: ColorValue }) {
  const stroke = StyleSheet.hairlineWidth * 2;
  const finder = (place: object) => (
    <View
      style={[
        styles.finder,
        place,
        { borderColor: color, borderWidth: stroke },
      ]}
    >
      <View style={[styles.finderInner, { borderColor: color, borderWidth: stroke }]} />
    </View>
  );
  return (
    <View style={styles.mark}>
      <View style={[styles.markFrame, { borderColor: color, borderWidth: stroke }]} />
      {finder({ top: 3, left: 3 })}
      {finder({ top: 3, right: 3 })}
      {finder({ bottom: 3, left: 3 })}
    </View>
  );
}

/** Equal columns for every tab not hidden with `href: null`, which Expo Router turns into `display: "none"`. */
export function HallTabBar({ state, descriptors, navigation }: TabBarProps) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const tabBottom = insets.bottom + 10;
  const shown = state.routes.filter(
    (route) => StyleSheet.flatten(descriptors[route.key].options.tabBarItemStyle)?.display !== "none",
  );
  const width = `${100 / shown.length}%` as const;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          height: 52 + tabBottom,
          paddingBottom: tabBottom,
        },
      ]}
    >
      {shown.map((route) => {
        const { options } = descriptors[route.key];
        const focused = state.routes[state.index]?.key === route.key;
        const color = focused ? colors.forest : colors.inkFaint;
        const label = options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (focused || event.defaultPrevented) {
                return;
              }
              navigation.navigate(route.name, route.params);
            }}
            style={[styles.tab, { width, maxWidth: width }]}
          >
            {options.tabBarIcon?.({ focused, color, size: 24 })}
            <View style={styles.caption}>
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingTop: 8,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 0,
  },
  caption: {
    marginTop: 4,
    height: 16,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  label: {
    width: "100%",
    textAlign: "center",
    fontFamily: "SourceSans3_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  mark: { width: 24, height: 24 },
  markFrame: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 2,
  },
  finder: {
    position: "absolute",
    width: 8,
    height: 8,
  },
  finderInner: {
    position: "absolute",
    top: 1.5,
    left: 1.5,
    right: 1.5,
    bottom: 1.5,
  },
});
