import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function SettingsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Settings</Text>
      <View style={styles.rows}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/change-password")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Change password</Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/privacy")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Privacy policy</Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void signOut().then(() => router.replace("/sign-in"));
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 28,
  },
  title: { textAlign: "left" },
  rows: { gap: 4 },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pressed: { opacity: 0.6 },
});
