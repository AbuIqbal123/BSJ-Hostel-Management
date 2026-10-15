import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DayRange, type DayRangeValue } from "@/components/day-range";
import { formatSpan } from "@/format-when";
import { kindLabel } from "@/requests";
import { useSession, type HistoryItem, type HistoryKind } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type KindFilter = HistoryKind | "all";

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "late_night", label: "Late-night" },
  { id: "home_going", label: "Home going" },
  { id: "guest_stay", label: "Guest stays" },
  { id: "outing", label: "Outing" },
];

function whenLine(item: HistoryItem): string {
  return formatSpan(item.startedAt, item.endedAt, item.kind === "home_going" || item.kind === "guest_stay");
}

function recordedLine(item: HistoryItem): string | null {
  const names = [item.exitRecordedBy, item.returnRecordedBy].filter(
    (name): name is string => name !== null && name.length > 0,
  );
  const unique = [...new Set(names)];
  if (unique.length === 0) {
    return null;
  }
  return `Recorded by ${unique.join(" and ")}`;
}

function openHistory(item: HistoryItem) {
  if (item.kind === "guest_stay") {
    router.push({ pathname: "/guest", params: { id: item.id } });
    return;
  }
  if (item.kind === "late_night" || item.kind === "home_going") {
    router.push({ pathname: "/permission", params: { id: item.id } });
    return;
  }
  router.push({
    pathname: "/outing",
    params: {
      place: item.place ?? "",
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      exitRecordedBy: item.exitRecordedBy ?? "",
      returnRecordedBy: item.returnRecordedBy ?? "",
      unused: item.unused ? "1" : "0",
    },
  });
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const colors = useHallColors();
  const title = item.who ?? item.place ?? kindLabel(item.kind);
  const recorded = recordedLine(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => openHistory(item)}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <View style={styles.cellTop}>
        <Text numberOfLines={1} style={[styles.cellTitle, { color: colors.ink }]}>
          {title}
        </Text>
        <Text style={[text.body, { color: colors.inkSoft }]}>{kindLabel(item.kind)}</Text>
      </View>
      <View style={styles.cellTop}>
        <Text numberOfLines={1} style={[styles.cellWhen, { color: colors.ink }]}>
          {whenLine(item)}
        </Text>
        {item.unused ? (
          <Text style={[text.body, { color: colors.inkFaint }]}>Unused</Text>
        ) : null}
      </View>
      {recorded ? (
        <Text numberOfLines={1} style={[text.body, { color: colors.inkFaint }]}>
          {recorded}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadHistory } = useSession();
  const [kind, setKind] = useState<KindFilter>("all");
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    void loadHistory({ kind, from: range.from, to: range.to }).then((result) => {
      if (id !== requestId.current) {
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
  }, [kind, loadHistory, range]);

  useFocusEffect(load);

  const back = () => goBackOr(navigation, "/settings");

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>History</Text>
      <View style={styles.controls}>
      <ScrollView
        horizontal
        accessibilityRole="tablist"
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        {KIND_FILTERS.map((item) => {
          const selected = kind === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setKind(item.id)}
              style={({ pressed }) => [styles.filter, pressed && styles.pressed]}
            >
              <Text style={[text.button, { color: selected ? colors.forest : colors.inkSoft }]}>
                {item.label}
              </Text>
              <View style={[styles.filterMark, { backgroundColor: selected ? colors.forest : "transparent" }]} />
            </Pressable>
          );
        })}
      </ScrollView>
      <DayRange value={range} onChange={setRange} />
      </View>
      {failed ? <Text style={[text.error, { color: colors.danger }]}>History didn't load</Text> : null}
      {items !== null && items.length === 0 && !failed ? (
        <Text style={[text.body, { color: colors.inkFaint }]}>No history</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
              <HistoryRow item={item} />
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
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  title: { textAlign: "left" },
  controls: { gap: 12 },
  filterScroll: { flexGrow: 0 },
  filters: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 18,
    paddingRight: 8,
  },
  filter: { minHeight: 44, justifyContent: "flex-end", gap: 8 },
  filterMark: { height: 2, borderRadius: 1 },
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
  cellWhen: { flex: 1 },
  pressed: { opacity: 0.6 },
});
