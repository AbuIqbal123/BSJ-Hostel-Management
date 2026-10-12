import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { roleLabel, useSession } from "@/session";
import { useAppearance } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type RowProps = {
  label: string;
  color: string;
  onPress: () => void;
  value?: string;
  chevron?: boolean;
};

function Row({ label, color, onPress, value, chevron = false }: RowProps) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[text.button, { color }]}>{label}</Text>
      {value ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>{value}</Text>
      ) : chevron ? (
        <Feather name="chevron-right" size={18} color={colors.inkFaint} />
      ) : null}
    </Pressable>
  );
}

export default function StaffSettingsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { dark, setDark } = useAppearance();
  const { user, signOut } = useSession();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      {user ? (
        <View style={styles.heading}>
          <Text numberOfLines={1} style={[text.hallName, styles.title, { color: colors.ink }]}>
            {user.full_name}
          </Text>
          <Text numberOfLines={1} selectable style={[text.body, { color: colors.inkSoft }]}>
            {`${user.username} · ${roleLabel(user.role)}`}
          </Text>
        </View>
      ) : null}
      <View style={styles.rows}>
        <Row label="Appearance" color={colors.ink} value={dark ? "Dark" : "Light"} onPress={() => setDark(!dark)} />
        <Row label="Change password" color={colors.ink} chevron onPress={() => router.push("/change-password")} />
        <Row
          label="Sign out"
          color={colors.danger}
          onPress={() => {
            void signOut().then(() => router.replace("/sign-in"));
          }}
        />
      </View>
      <Text style={[text.body, styles.version, { color: colors.inkFaint }]}>{`Version ${version}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 28 },
  heading: { gap: 8 },
  title: { textAlign: "left" },
  rows: { gap: 4 },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pressed: { opacity: 0.6 },
  version: { marginTop: "auto" },
});
