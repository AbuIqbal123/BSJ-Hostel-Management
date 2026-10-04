import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession, type HallNotification } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function notificationSentence(item: HallNotification): string {
  const place = item.place.trim();
  const toPlace = place.length > 0 ? ` to ${place}` : "";
  if (item.permissionType === "late_night") {
    return item.decision === "approved"
      ? `Late night${toPlace} was approved.`
      : `Late night${toPlace} was not approved.`;
  }
  return item.decision === "approved"
    ? `Going home${toPlace} was approved.`
    : `Going home${toPlace} was not approved.`;
}

export default function NotificationsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadNotifications, markNotificationsRead } = useSession();
  const [items, setItems] = useState<HallNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const marked = useRef(false);

  const load = useCallback(() => {
    let active = true;
    marked.current = false;
    void loadNotifications().then(async (result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setItems(null);
        setFailed(true);
        return;
      }
      setFailed(false);
      setItems(result.items);
      if (!marked.current) {
        marked.current = true;
        await markNotificationsRead();
      }
    });
    return () => {
      active = false;
    };
  }, [loadNotifications, markNotificationsRead]);

  useFocusEffect(load);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          router.navigate("/home");
        }}
        style={styles.back}
      >
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Notifications</Text>
      {failed ? (
        <Text style={[text.button, { color: colors.danger }]}>Notifications didn't load.</Text>
      ) : null}
      {!failed && items !== null && items.length === 0 ? (
        <Text style={[text.button, { color: colors.inkFaint }]}>No notifications.</Text>
      ) : null}
      {!failed && items !== null && items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item) => (
            <Text key={item.id} style={[text.button, { color: colors.ink }]}>
              {notificationSentence(item)}
            </Text>
          ))}
        </View>
      ) : null}
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
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  title: { textAlign: "left" },
  list: { gap: 16 },
});
