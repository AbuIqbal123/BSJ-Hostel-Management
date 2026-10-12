import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

import { useSession } from "@/session";
import { homePath } from "@/staff";
import { useHallColors } from "@/theme/colors";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function ResidentLayout() {
  const colors = useHallColors();
  const { ready, user } = useSession();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    return () => subscription.remove();
  }, []);

  if (!ready) {
    return <View style={[styles.hold, { backgroundColor: colors.paper }]} />;
  }
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (user.role !== "resident") {
    return <Redirect href={homePath(user.role)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
        animation: reduced ? "fade" : "default",
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="plan" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  hold: { flex: 1 },
});
