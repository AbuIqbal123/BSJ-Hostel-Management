import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { StyleSheet, View } from "react-native";

import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function StaffLayout() {
  const colors = useHallColors();
  const { ready, user } = useSession();

  if (!ready) {
    return <View style={[styles.hold, { backgroundColor: colors.paper }]} />;
  }
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (user.role === "resident") {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="out" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  hold: { flex: 1 },
});
