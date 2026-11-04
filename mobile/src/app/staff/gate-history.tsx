import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DayRange, type DayRangeValue } from "@/components/day-range";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { openCachedList, rememberFirstPage, type ListSnapshot } from "@/list-cache";
import { pageQuery } from "@/list-page";
import { useListPage } from "@/use-list-page";
import { useSession } from "@/session";
import { readActivity, readTotal, trimStop, type GateEvent } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type EventFilter = "exit" | "return" | "guest_arrival" | "guest_departure" | null;

const EVENTS: { value: EventFilter; label: string }[] = [
  { value: null, label: "All" },
  { value: "exit", label: "Exit" },
  { value: "return", label: "Return" },
  { value: "guest_arrival", label: "Guest in" },
  { value: "guest_departure", label: "Guest out" },
];

function historyKey(event: EventFilter, q: string, range: DayRangeValue): string {
  return `${event ?? ""}|${q}|${range.from ?? ""}|${range.to ?? ""}`;
}

function historyPath(event: EventFilter, q: string, range: DayRangeValue, offset: number): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (event) {
    search.set("event", event);
  }
  if (q.trim()) {
    search.set("q", q.trim());
  }
  if (range.from) {
    search.set("from", range.from);
  }
  if (range.to) {
    search.set("to", range.to);
  }
  return `/gate/activity?${search.toString()}`;
}

export default function GateHistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [event, setEvent] = useState<EventFilter>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const qRef = useRef(q);
  const eventRef = useRef(event);
  const rangeRef = useRef(range);
  const cacheRef = useRef(new Map<string, ListSnapshot<GateEvent>>());
  qRef.current = q;
  eventRef.current = event;
  rangeRef.current = range;

  const list = useListPage<GateEvent>({
    idOf: (item) => item.key,
    loadPage: async (offset) => {
      const reply = await staffRequest(historyPath(eventRef.current, qRef.current, rangeRef.current, offset));
      if (!reply.ok) {
        return { error: trimStop(reply.message) };
      }
      const result = { items: readActivity(reply.data, offset), total: readTotal(reply.data) };
      rememberFirstPage(cacheRef.current, historyKey(eventRef.current, qRef.current, rangeRef.current), offset, result);
      return result;
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    openCachedList(cacheRef.current, historyKey(event, q, range), list);
  }, [event, q, range, list.clear, list.load, list.revise]);

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const back = () => goBackOr(navigation, "/staff/settings");

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />
      }
      onMomentumScrollEnd={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 120) {
          list.loadNext();
        }
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Gate history</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>Everyone recorded at the gate, newest first</Text>
      <SearchField value={query} placeholder="Name or room" onChange={setQuery} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {EVENTS.map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={event === item.value}
            onPress={() => setEvent(item.value)}
          />
        ))}
      </ScrollView>
      <DayRange value={range} onChange={setRange} />
      <View style={styles.list}>
        <PagedList
          rows={list.rows}
          error={list.error}
          pageError={list.pageError}
          showListSkeleton={list.showListSkeleton}
          showPageSkeleton={list.showPageSkeleton}
          filling={list.filling}
          onRetry={list.rows && list.rows.length > 0 ? list.refresh : list.retry}
          onRetryPage={() => list.loadNext(true)}
          empty={<Text style={[text.body, { color: colors.inkFaint }]}>No matching gate lines</Text>}
        >
          <View>
            {(list.rows ?? []).map((item, index, all) => (
              <DenseRow
                key={item.key}
                title={item.title}
                detail={item.detail}
                time={item.at}
                first={index === 0}
                last={index === all.length - 1}
              />
            ))}
          </View>
        </PagedList>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 16 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginLeft: -6 },
  title: { textAlign: "left" },
  chips: { gap: 8, paddingVertical: 4 },
  list: { marginTop: 4 },
});
