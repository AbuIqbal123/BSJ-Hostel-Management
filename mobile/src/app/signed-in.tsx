import { Redirect, router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { HallButton } from "@/components/hall-button";
import { roleLabel, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function SignedInScreen() {
  const colors = useHallColors();
  const { user, signOut } = useSession();

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.paper }}
      showsVerticalScrollIndicator={false}
    >
      <Text selectable style={[text.name, { color: colors.ink }]}>
        {user.full_name}
      </Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{roleLabel(user.role)}</Text>
      <Text selectable style={[text.mono, { color: colors.inkFaint }]}>
        {user.username}
      </Text>
      <HallButton label="Change password" onPress={() => router.push("/change-password")} />
      <HallButton
        label="Sign out"
        onPress={() => {
          void signOut().then(() => router.replace("/sign-in"));
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 16,
  },
});
