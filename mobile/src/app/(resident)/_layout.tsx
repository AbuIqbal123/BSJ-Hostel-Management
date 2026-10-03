import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View } from "react-native";

import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

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
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="plan" options={{ title: "Plan an outing" }} />
      <Tabs.Screen name="pass" options={{ title: "My hall pass" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hold: { flex: 1 },
});
