import { Redirect, router } from "expo-router";
import { ScrollView, Text } from "react-native";

import { HallButton } from "@/components/hall-button";
import { roleLabel, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

export default function SignedInScreen() {
  const colors = useHallColors();
  const { user, signOut } = useSession();

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, gap: 16 }}
      style={{ backgroundColor: colors.paper }}
    >
      <Text
        selectable
        style={{
          color: colors.ink,
          fontFamily: "SourceSerif4_600SemiBold",
          fontSize: 32,
          letterSpacing: -0.4,
        }}
      >
        {user.full_name}
      </Text>
      <Text
        style={{
          color: colors.inkSoft,
          fontFamily: "SourceSans3_400Regular",
          fontSize: 17,
        }}
      >
        {roleLabel(user.role)}
      </Text>
      <Text
        selectable
        style={{
          color: colors.inkFaint,
          fontFamily: "IBMPlexMono_500Medium",
          fontSize: 15,
        }}
      >
        {user.username}
      </Text>
      <HallButton
        label="Sign out"
        onPress={() => {
          void signOut().then(() => router.replace("/sign-in"));
        }}
      />
    </ScrollView>
  );
}
