import { Feather } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View, type ColorValue } from "react-native";

import { useSession } from "@/session";
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

export default function ResidentLayout() {
  const colors = useHallColors();
  const { ready, user } = useSession();

  if (!ready) {
    return <View style={[styles.hold, { backgroundColor: colors.paper }]} />;
  }
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (user.role !== "resident") {
    return <Redirect href="/signed-in" />;
  }

  return (
    <Tabs
      initialRouteName="home"
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
        },
        tabBarLabelStyle: {
          fontFamily: "SourceSans3_400Regular",
          fontSize: 12,
        },
      }}
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
        name="permissions"
        options={{
          title: "Permissions",
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
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
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
        }}
      />
      <Tabs.Screen name="plan" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hold: { flex: 1 },
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
