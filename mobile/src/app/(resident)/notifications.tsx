import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen, formatWhenParts } from "@/format-when";
import { useSession, type HallNotification } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function requestName(item: HallNotification): string {
  return item.permissionType === "late_night" ? "late-night request" : "home-going request";
}

function notificationSentence(item: HallNotification): string {
  const name = item.decidedBy.trim() || "the hall";
  if (item.decision === "approved") {
    return `Your ${requestName(item)} has been approved by ${name}.`;
  }
  return `Your ${requestName(item)} has been rejected by ${name}.`;
}

function whenLine(item: HallNotification): string {
  const start = formatWhenParts(item.departureAt);
  const end = formatWhenParts(item.expectedReturnAt);
  if (!start || !end) {
    return `${formatWhen(item.departureAt)} to ${formatWhen(item.expectedReturnAt)}`;
  }
  if (item.permissionType === "home_going") {
    return start.day === end.day ? start.day : `${start.day} to ${end.day}`;
  }
  if (start.day === end.day) {
    return `${start.clock} to ${end.clock}, ${start.day}`;
  }
  return `${start.clock}, ${start.day} to ${end.clock}, ${end.day}`;
}

function NotificationRow({ item }: { item: HallNotification }) {
  const colors = useHallColors();
  const sentence = notificationSentence(item);
  const place = item.place.trim();
  const detail = place.length > 0 ? `${place} · ${whenLine(item)}` : whenLine(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sentence} ${detail}`}
      onPress={() => router.push({ pathname: "/permission", params: { id: item.permissionId } })}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <Text style={[styles.cellTitle, { color: colors.ink }]}>{sentence}</Text>
      <Text numberOfLines={1} style={[styles.detail, { color: colors.inkSoft }]}>
        {detail}
      </Text>
    </Pressable>
  );
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
        <View>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
              <NotificationRow item={item} />
            </View>
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
  hairline: { height: StyleSheet.hairlineWidth },
  cell: { justifyContent: "center", gap: 2, paddingVertical: 10 },
  cellTitle: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 17,
    lineHeight: 22,
  },
  detail: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: { opacity: 0.6 },
});
