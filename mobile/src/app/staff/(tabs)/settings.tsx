import Constants from "expo-constants";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BiometricSettingsRow } from "@/components/biometric-settings-row";
import { NotificationsOffRow } from "@/components/notifications-off-row";
import { SettingsRow } from "@/components/settings-row";
import { runsOffice } from "@/office";
import { roleLabel, useSession } from "@/session";
import { SIGNED_OUT_PARAM, confirmSignOut } from "@/sign-out";
import { useAppearance } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

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
            {roleLabel(user.role)}
          </Text>
        </View>
      ) : null}
      <View style={styles.rows}>
        <SettingsRow
          label="Appearance"
          color={colors.ink}
          value={dark ? "Dark" : "Light"}
          onPress={() => setDark(!dark)}
        />
        <BiometricSettingsRow />
        <NotificationsOffRow />
        <SettingsRow
          label="Gate history"
          color={colors.ink}
          chevron
          onPress={() => router.push("/staff/gate-history")}
        />
        {user && runsOffice(user.role) ? (
          <SettingsRow
            label="Office settings"
            color={colors.ink}
            chevron
            onPress={() => router.push("/staff/office")}
          />
        ) : null}
        <SettingsRow
          label="Change password"
          color={colors.ink}
          chevron
          onPress={() => router.push("/change-password")}
        />
        <SettingsRow
          label="Sign out"
          color={colors.danger}
          onPress={() => {
            confirmSignOut(signOut, () => {
              router.replace({ pathname: "/sign-in", params: { notice: SIGNED_OUT_PARAM } });
            });
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
  version: { marginTop: "auto" },
});
