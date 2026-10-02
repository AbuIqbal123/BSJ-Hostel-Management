import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallMark } from "@/components/hall-mark";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function OpeningScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { ready, user } = useSession();

  if (ready && user) {
    return <Redirect href="/signed-in" />;
  }
  if (ready) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: 32,
        gap: 16,
      }}
    >
      <HallMark />
      <Text style={[text.hallName, { color: colors.ink }]}>Begum Sultan Jahan Hall</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>Opening the hall</Text>
    </View>
  );
}
