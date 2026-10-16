import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { SkeletonRows } from "@/components/skeleton";
import { useDelayedLoading } from "@/use-delayed-loading";
import { DayRange, type DayRangeValue } from "@/components/day-range";
import { formatSpan } from "@/format-when";
import { mergeHistoryRows } from "@/history-rows";
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
      accessibilityLabel={[kindLabel(item.kind), whenLine(item), recorded].filter(Boolean).join(", ")}
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
  const [olderFailed, setOlderFailed] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const requestId = useRef(0);
  const paging = useRef(false);
  const showListSkeleton = useDelayedLoading((items === null || refreshing) && !failed) && !failed;
  const showOlderSkeleton = useDelayedLoading(olderBusy) && olderFailed === null;
  const queryKey = useRef("");

  const load = useCallback(() => {
    const key = `${kind}|${range.from ?? ""}|${range.to ?? ""}`;
    const changed = queryKey.current !== key;
    queryKey.current = key;
    if (changed) {
      setItems(null);
    }
    setRefreshing(false);
    const id = ++requestId.current;
    void loadHistory({ kind, from: range.from, to: range.to }).then((result) => {
      if (id !== requestId.current) {
        return;
      }
      if (result.error !== null) {
        setFailed(true);
        if (changed) {
          setItems(null);
          setNext(null);
        }
        return;
      }
      setFailed(false);
      setOlderFailed(null);
      setItems(result.items);
      setNext(result.next);
    });
  }, [kind, loadHistory, range]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    const id = ++requestId.current;
    void loadHistory({ kind, from: range.from, to: range.to }).then((result) => {
      if (id !== requestId.current) {
        return;
      }
      setRefreshing(false);
      if (result.error !== null) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setOlderFailed(null);
      setItems(result.items);
      setNext(result.next);
    });
  }, [kind, loadHistory, range]);

  // Older pages load only when she asks, so the phone never holds years of rows.
  const older = useCallback(() => {
    if (!next || paging.current) {
      return;
    }
    paging.current = true;
    setOlderBusy(true);
    const id = requestId.current;
    void loadHistory({ kind, from: range.from, to: range.to, cursor: next }).then((result) => {
      paging.current = false;
      setOlderBusy(false);
      if (id !== requestId.current) {
        return;
      }
      if (result.error !== null) {
        setOlderFailed(result.error);
        return;
      }
      setOlderFailed(null);
      setItems((current) => mergeHistoryRows(current ?? [], result.items));
      setNext(result.next);
    });
  }, [kind, loadHistory, next, range]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.inkFaint} />}
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
      {showListSkeleton ? <SkeletonRows count={4} kind="row" /> : null}
      {failed && (items === null || items.length === 0) ? (
        <ListError message="History didn't load" onRetry={load} />
      ) : null}
      {failed && items !== null && items.length > 0 ? (
        <ListError message="History didn't load" onRetry={refresh} />
      ) : null}
      {!showListSkeleton && items !== null && items.length === 0 && !failed ? <EmptyState message="No history" /> : null}
      {!showListSkeleton && items !== null && items.length > 0 ? (
        <View>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
              <HistoryRow item={item} />
            </View>
          ))}
        </View>
      ) : null}
      {showOlderSkeleton ? <SkeletonRows count={1} kind="row" /> : null}
      {olderFailed ? <RetryRow message={olderFailed} onRetry={older} /> : null}
      {next && !olderFailed && !showOlderSkeleton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show older"
          onPress={older}
          hitSlop={12}
          style={styles.older}
        >
          <Text style={[text.button, { color: colors.forest }]}>Show older</Text>
        </Pressable>
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
  failed: { alignItems: "center", gap: 12 },
  older: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
