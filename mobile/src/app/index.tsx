import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallMark } from "@/components/hall-mark";
import { useSession } from "@/session";
import { homePath } from "@/staff-home";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function OpeningScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { ready, user } = useSession();

  if (ready && user) {
    return <Redirect href={homePath(user.role)} />;
  }
  if (ready) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.paper,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <HallMark />
      <Text style={[text.hallName, { color: colors.ink }]}>Begum Sultan Jahan Hall</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>Opening the hall</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
});
