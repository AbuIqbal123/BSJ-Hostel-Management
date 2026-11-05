import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BiometricSettingsRow } from "@/components/biometric-settings-row";
import { NotificationsOffRow } from "@/components/notifications-off-row";
import { SettingsRow } from "@/components/settings-row";
import { hallBundleLabel } from "@/hall-update";
import { useSession } from "@/session";
import { SIGNED_OUT_PARAM, confirmSignOut } from "@/sign-out";
import { useAppearance } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function SettingsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { dark, setDark } = useAppearance();
  const { user, loadResidentHome, signOut } = useSession();
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const bundle = hallBundleLabel();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadResidentHome().then((result) => {
        if (!active || result.error !== null) {
          return;
        }
        setRoomLabel(result.home.roomLabel);
      });
      return () => {
        active = false;
      };
    }, [loadResidentHome]),
  );

  const detail =
    user === null ? null : roomLabel ? `${user.username} · ${roomLabel}` : user.username;

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
          <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{user.full_name}</Text>
          <Text selectable style={[text.body, { color: colors.inkSoft }]}>
            {detail}
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
        <SettingsRow label="Profile" color={colors.ink} chevron onPress={() => router.push("/profile")} />
        <SettingsRow label="History" color={colors.ink} chevron onPress={() => router.push("/history")} />
        <SettingsRow
          label="Change password"
          color={colors.ink}
          chevron
          onPress={() => router.push("/change-password")}
        />
        <SettingsRow label="Privacy policy" color={colors.ink} chevron onPress={() => router.push("/privacy")} />
        <SettingsRow
          label="Delete account"
          color={colors.danger}
          chevron
          onPress={() => router.push("/delete-account")}
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
      <Text selectable style={[text.body, styles.version, { color: colors.inkFaint }]}>
        {bundle}
      </Text>
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
  heading: { gap: 8 },
  title: { textAlign: "left" },
  rows: { gap: 4 },
  version: { marginTop: "auto" },
});
