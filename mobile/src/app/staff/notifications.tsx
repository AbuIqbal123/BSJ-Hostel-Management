import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { formatWhen } from "@/format-when";
import { useSession } from "@/session";
import { readStaffNotices, type StaffNotice } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function NoticeRow({ item }: { item: StaffNotice }) {
  const colors = useHallColors();
  const detail = [item.room, formatWhen(item.at)].filter(Boolean).join(" · ");
  return (
    <View accessible accessibilityLabel={`${item.sentence} ${detail}`} style={styles.cell}>
      <Text style={[styles.cellTitle, { color: colors.ink }]}>{item.sentence}</Text>
      <Text numberOfLines={1} style={[styles.detail, { color: colors.inkSoft }]}>
        {detail}
      </Text>
    </View>
  );
}

export default function StaffNotificationsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const [items, setItems] = useState<StaffNotice[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let active = true;
    void staffRequest("/register/notifications").then(async (reply) => {
      if (!active) {
        return;
      }
      setFailed(!reply.ok);
      setItems(reply.ok ? readStaffNotices(reply.data) : null);
      if (reply.ok) {
        await staffRequest("/register/notifications/read", {});
      }
    });
    return () => {
      active = false;
    };
  }, [staffRequest]);

  useFocusEffect(load);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => goBackOr(navigation, "/staff")}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Notifications</Text>
      {failed ? <Text style={[text.button, { color: colors.danger }]}>Notifications didn't load</Text> : null}
      {items !== null && items.length === 0 ? (
        <Text style={[text.button, { color: colors.inkFaint }]}>No notifications</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View>
          {items.map((item, index) => (
            <View key={item.key}>
              {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
              <NoticeRow item={item} />
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 28 },
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  title: { textAlign: "left" },
  hairline: { height: StyleSheet.hairlineWidth },
  cell: { justifyContent: "center", gap: 2, paddingVertical: 10 },
  cellTitle: { fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  detail: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
});
