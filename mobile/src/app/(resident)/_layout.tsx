import { Feather } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View, type ColorValue } from "react-native";

import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

function TabIcon({ name, color }: { name: "home" | "calendar" | "credit-card" | "settings"; color: ColorValue }) {
  return <Feather name={name} size={24} color={color} />;
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
        name="plan"
        options={{
          title: "Plan an outing",
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            if (navigation.isFocused()) {
              return;
            }
            router.navigate({
              pathname: "/plan",
              params: { outing: "", place: "", startsAt: "", expectedReturnAt: "" },
            });
          },
        })}
      />
      <Tabs.Screen
        name="pass"
        options={{
          title: "My hall pass",
          tabBarIcon: ({ color }) => <TabIcon name="credit-card" color={color} />,
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
  hold: { flex: 1 },
});
