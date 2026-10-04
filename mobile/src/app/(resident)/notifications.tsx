import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen, formatWhenParts } from "@/format-when";
import { useSession, type HallNotification } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function kindLabel(item: HallNotification): string {
  return item.permissionType === "late_night" ? "Late-night" : "Home going";
}

function decisionLabel(item: HallNotification): string {
  return item.decision === "approved" ? "Approved" : "Not approved";
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

function decidedLine(item: HallNotification): string {
  const when = formatWhenParts(item.createdAt);
  if (!when) {
    return `Decided ${formatWhen(item.createdAt)}`;
  }
  return `Decided ${when.clock}, ${when.day}`;
}

function NotificationRow({ item }: { item: HallNotification }) {
  const colors = useHallColors();
  const decisionColor = item.decision === "approved" ? colors.forest : colors.danger;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/permission", params: { id: item.permissionId } })}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <View style={styles.cellTop}>
        <Text numberOfLines={1} style={[styles.cellTitle, { color: colors.ink }]}>
          {item.place}
        </Text>
        <Text style={[text.body, { color: decisionColor }]}>{decisionLabel(item)}</Text>
      </View>
      <Text style={[text.body, { color: colors.inkSoft }]}>{kindLabel(item)}</Text>
      <Text numberOfLines={1} style={[text.body, { color: colors.ink }]}>
        {whenLine(item)}
      </Text>
      <Text numberOfLines={1} style={[text.body, { color: colors.inkFaint }]}>
        {decidedLine(item)}
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
  cell: { paddingVertical: 12, gap: 2 },
  cellTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cellTitle: {
    flex: 1,
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 17,
    lineHeight: 22,
  },
  pressed: { opacity: 0.6 },
});
