import { useCallback, useState } from "react";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { Linking, Platform, Pressable, StyleSheet, Text } from "react-native";

import { notificationRowVisible } from "@/notification-settings";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

/** Shown when she has denied notifications. Hidden on Android while push is switched off, and for gate. */
export function NotificationsOffRow() {
  const colors = useHallColors();
  const { user } = useSession();
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setVisible(false);
        return;
      }
      let active = true;
      void Notifications.getPermissionsAsync()
        .then(({ status }) => {
          if (!active) {
            return;
          }
          setVisible(notificationRowVisible({ platform: Platform.OS, role: user.role, status }));
        })
        .catch(() => {
          if (active) {
            setVisible(false);
          }
        });
      return () => {
        active = false;
      };
    }, [user]),
  );

  if (!visible) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications are off, Turn on in Settings"
      onPress={() => {
        void Linking.openSettings().catch(() => undefined);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[text.button, { color: colors.ink }]}>Notifications are off</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>Turn on in Settings</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pressed: { opacity: 0.6 },
});
