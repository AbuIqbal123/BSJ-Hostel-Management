import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { PagedList } from "@/components/paged-list";
import { DayRange, type DayRangeValue } from "@/components/day-range";
import { PlainRow, RowHairline } from "@/components/plain-row";
import { formatSpan } from "@/format-when";
import { openCachedList, rememberFirstPage, type ListSnapshot } from "@/list-cache";
import { historyPartsLayout } from "@/row-layout";
import { guestStayNoticeTitle } from "@/notices";
import { kindLabel } from "@/requests";
import { useSession, type HistoryItem, type HistoryKind } from "@/session";
import { useListPage } from "@/use-list-page";
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
    router.push({ pathname: "/guest", params: { id: item.guestStayId ?? item.id } });
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

function decisionTitle(item: HistoryItem): string | null {
  if (!item.noticeKind) {
    return null;
  }
  const outcome = item.decision === "approved" ? "approved" : item.decision === "rejected" ? "declined" : null;
  return guestStayNoticeTitle({
    kind: item.noticeKind,
    outcome,
    hostName: item.hostName ?? "",
    actorName: item.actorName ?? "",
  });
}

function HistoryRow({ item, first }: { item: HistoryItem; first: boolean }) {
  const { fontScale } = useWindowDimensions();
  const sentence = decisionTitle(item);
  const title = sentence ?? item.who ?? item.place ?? kindLabel(item.kind);
  const recorded = recordedLine(item);
  const when = whenLine(item);
  const dateLayout = historyPartsLayout(when, fontScale);
  const parts = sentence
    ? [item.who, when].filter((part): part is string => part !== null && part.length > 0)
    : item.unused
      ? [when, "Unused"]
      : [when];
  return (
    <View>
      {first ? null : <RowHairline />}
      <PlainRow
        title={title}
        aside={kindLabel(item.kind)}
        parts={parts}
        keepParts={dateLayout.keepParts}
        wrapLines={dateLayout.wrapLines}
        extra={recorded}
        mutedExtra
        onPress={() => openHistory(item)}
        label={[sentence ?? kindLabel(item.kind), item.who, when, item.unused ? "Unused" : null, recorded]
          .filter(Boolean)
          .join(", ")}
      />
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadHistory } = useSession();
  const [kind, setKind] = useState<KindFilter>("all");
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const cacheRef = useRef(new Map<string, ListSnapshot<HistoryItem>>());
  const kindRef = useRef(kind);
  const rangeRef = useRef(range);
  kindRef.current = kind;
  rangeRef.current = range;
  const list = useListPage<HistoryItem>({
    mode: "cursor",
    auto: false,
    idOf: (item) => item.id,
    loadPage: async (cursor) => {
      const currentKind = kindRef.current;
      const currentRange = rangeRef.current;
      const key = `${currentKind}|${currentRange.from ?? ""}|${currentRange.to ?? ""}`;
      const result = await loadHistory({
        kind: currentKind,
        from: currentRange.from,
        to: currentRange.to,
        cursor,
      });
      if (result.error !== null) {
        const error = cursor ? result.error : "History didn't load";
        if (cursor === null) {
          rememberFirstPage(cacheRef.current, key, 0, { error });
        }
        return { error };
      }
      if (cursor === null) {
        rememberFirstPage(cacheRef.current, key, 0, {
          items: result.items,
          total: result.next ? result.items.length + 1 : result.items.length,
        });
      }
      return { items: result.items, next: result.next };
    },
  });
  const filterKey = `${kind}|${range.from ?? ""}|${range.to ?? ""}`;

  useFocusEffect(
    useCallback(() => {
      openCachedList(cacheRef.current, filterKey, list);
    }, [filterKey, list.clear, list.load, list.revise]),
  );

  const back = () => goBackOr(navigation, "/settings");

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />}
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
      <View style={styles.list}>
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        onRetry={list.rows && list.rows.length > 0 ? list.refresh : list.retry}
        onRetryPage={() => list.loadNext(true)}
        empty={<Text style={[styles.emptyLine, { color: colors.inkFaint }]}>No history</Text>}
        footer={
          list.hasMore && !list.showPageSkeleton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show older"
              onPress={() => list.loadNext()}
              hitSlop={12}
              style={styles.older}
            >
              <Text style={[text.button, { color: colors.forest }]}>Show older</Text>
            </Pressable>
          ) : null
        }
      >
        <View>
          {(list.rows ?? []).map((item, index) => (
            <HistoryRow key={item.id} item={item} first={index === 0} />
          ))}
        </View>
      </PagedList>
      </View>
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
  list: { marginTop: -4 },
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
  emptyLine: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
    lineHeight: 22,
  },
  older: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
