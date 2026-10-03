import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { Platform, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHallColors } from "@/theme/colors";

function TabIcon({ name, color }: { name: "home" | "calendar" | "settings"; color: ColorValue }) {
  return <Feather name={name} size={24} color={color} />;
}

function QrMark({ color }: { color: ColorValue }) {
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

export default function ResidentTabs() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const systemBottom = Math.max(insets.bottom, Platform.OS === "android" ? 48 : 0);
  const tabBottom = systemBottom + 10;

  return (
    <Tabs
      initialRouteName="home"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        animation: "none",
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
          height: 52 + tabBottom,
          paddingBottom: tabBottom,
          paddingTop: 8,
        },
      }}
      tabBar={({ state, descriptors, navigation }) => (
          <View
            style={[
              styles.bar,
              {
                backgroundColor: colors.paper,
                borderTopColor: colors.line,
                height: 52 + tabBottom,
                paddingTop: 8,
                paddingBottom: tabBottom,
              },
            ]}
          >
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const hidden = StyleSheet.flatten(options.tabBarItemStyle)?.display === "none";
              if (hidden) {
                return null;
              }
              const focused = state.index === index;
              const color = focused ? colors.forest : colors.inkFaint;
              const label =
                typeof options.tabBarLabel === "string"
                  ? options.tabBarLabel
                  : (options.title ?? route.name);
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
                  style={styles.tab}
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
      )}
      screenListeners={({ navigation }) => ({
        tabPress: (event) => {
          if (navigation.isFocused()) {
            event.preventDefault();
          }
        },
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pass"
        options={{
          title: "Pass",
          tabBarIcon: ({ color }) => <QrMark color={color} />,
        }}
      />
      <Tabs.Screen
        name="permissions"
        options={{
          title: "Permissions",
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
        }}
      />
    </Tabs>
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
    width: "25%",
    maxWidth: "25%",
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
