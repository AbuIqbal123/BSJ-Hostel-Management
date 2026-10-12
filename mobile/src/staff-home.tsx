import { Redirect, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { HallMark } from "@/components/hall-mark";
import { roleLabel, useSession, type HallRole } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export function homePath(role: HallRole): "/home" | "/gate" | "/warden" | "/provost" {
  return role === "resident" ? "/home" : `/${role}`;
}

export function StaffHome({ role }: { role: Exclude<HallRole, "resident"> }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (user.role !== role) {
    return <Redirect href={homePath(user.role)} />;
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.paper, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.mark}>
        <HallMark />
        <Text selectable style={[text.hallName, { color: colors.ink }]}>
          {`Welcome, ${user.full_name}`}
        </Text>
        <Text style={[text.body, { color: colors.inkSoft }]}>{roleLabel(user.role)}</Text>
      </View>
      <HallButton
        label="Sign out"
        onPress={() => {
          void signOut().then(() => router.replace("/sign-in"));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 28 },
  mark: { alignItems: "center", gap: 12 },
});
