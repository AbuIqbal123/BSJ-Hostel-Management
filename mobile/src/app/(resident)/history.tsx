import { useCallback, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen, formatWhenParts } from "@/format-when";
import { useSession, type HistoryItem, type HistoryKind } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function kindLabel(kind: HistoryKind): string {
  switch (kind) {
    case "late_night":
      return "Late-night";
    case "home_going":
      return "Home going";
    case "guest_stay":
      return "Guest stay";
    case "outing":
      return "Outing";
  }
}

function whenLine(item: HistoryItem): string {
  if (item.kind === "home_going" || item.kind === "guest_stay") {
    const start = formatWhenParts(item.startedAt)?.day ?? item.startedAt;
    const end = formatWhenParts(item.endedAt)?.day ?? item.endedAt;
    return start === end ? start : `${start} to ${end}`;
  }
  return `${formatWhen(item.startedAt)} to ${formatWhen(item.endedAt)}`;
}

export default function HistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadHistory } = useSession();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let active = true;
    void loadHistory().then((result) => {
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
    });
    return () => {
      active = false;
    };
  }, [loadHistory]);

  useFocusEffect(load);

  const back = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.navigate("/home");
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>History</Text>
      {failed ? (
        <Text style={[text.error, { color: colors.danger }]}>History didn't load.</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View>
          {items.map((item, index) => {
            const title = item.who ?? item.place ?? kindLabel(item.kind);
            const recorded = [item.exitRecordedBy, item.returnRecordedBy].filter(
              (name): name is string => name !== null && name.length > 0,
            );
            return (
              <View key={item.id}>
                {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
                <View style={styles.item}>
                  <Text style={[styles.place, { color: colors.ink }]}>{title}</Text>
                  <Text style={[text.body, { color: colors.inkSoft }]}>{kindLabel(item.kind)}</Text>
                  <Text style={[text.body, { color: colors.ink }]}>{whenLine(item)}</Text>
                  {item.unused ? (
                    <Text style={[text.body, { color: colors.inkSoft }]}>Unused</Text>
                  ) : null}
                  {recorded.length > 0 ? (
                    <Text style={[text.body, { color: colors.inkSoft }]}>
                      {`Recorded by ${recorded.join(", ")}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
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
  item: { paddingVertical: 14, gap: 4 },
  place: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  hairline: { height: StyleSheet.hairlineWidth },
});
