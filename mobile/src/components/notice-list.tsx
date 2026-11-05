import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation, type Href } from "expo-router";
import { AppState, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { onHallRefresh } from "@/hall-refresh";
import { BackMark } from "@/components/back-mark";
import { EmptyState } from "@/components/list-state";
import { PagedList } from "@/components/paged-list";
import { DayRange, type DayRangeValue } from "@/components/day-range";
import { FilterChip } from "@/components/filter-chip";
import { FilterChipRow } from "@/components/filter-chip-row";
import { SearchField } from "@/components/search-field";
import { openCachedList, rememberFirstPage, type ListSnapshot } from "@/list-cache";
import {
  markNoticeReadInCache,
  markNoticesReadUpToInCache,
  noticeListKey,
  readNoticePage,
  readUnreadCount,
  type Notice,
  type NoticeFilter,
} from "@/notices";
import { setBadge } from "@/push";
import { useListPage } from "@/use-list-page";
import { useSession, type HallRole } from "@/session";
import { trimStop } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useDebouncedValue } from "@/use-debounced-value";

const FILTERS: { value: NoticeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "needs_action", label: "Needs action" },
];

function NoticeCard({ item, onPress }: { item: Notice; onPress: () => void }) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.unread ? "New" : "", item.title, item.detail, item.status ?? "", item.when]
        .filter(Boolean)
        .join(". ")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: item.unread ? colors.forest : colors.line },
        pressed && styles.pressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={[styles.detail, { color: colors.inkSoft }]}>
        {[item.detail, item.when].filter(Boolean).join(" · ")}
      </Text>
      {item.status ? (
        <Text numberOfLines={1} style={[styles.status, { color: item.needsAction ? colors.pending : colors.forest }]}>
          {item.status}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** The inbox for any role: filter chips, cards, mark all read, cursor pages. Staff add search and dates. */
export function NoticeList({ base, role, back, staff }: { base: string; role: HallRole; back: Href; staff: boolean }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const [filter, setFilter] = useState<NoticeFilter>("all");
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const cacheRef = useRef(new Map<string, ListSnapshot<Notice>>());
  const filterRef = useRef(filter);
  const qRef = useRef(q);
  const rangeRef = useRef(range);
  filterRef.current = filter;
  qRef.current = q;
  rangeRef.current = range;
  const list = useListPage<Notice>({
    mode: "cursor",
    auto: false,
    idOf: (item) => item.id,
    loadPage: async (cursor) => {
      const currentFilter = filterRef.current;
      const currentQ = qRef.current;
      const currentRange = rangeRef.current;
      const key = noticeListKey(currentFilter, currentQ, currentRange.from, currentRange.to);
      const search = new URLSearchParams({ filter: currentFilter });
      if (staff && currentQ.trim()) {
        search.set("q", currentQ.trim());
      }
      if (staff && currentRange.from) {
        search.set("from", currentRange.from);
      }
      if (staff && currentRange.to) {
        search.set("to", currentRange.to);
      }
      if (cursor) {
        search.set("cursor", cursor);
      }
      const reply = await staffRequest(`${base}?${search.toString()}`);
      if (!reply.ok) {
        const error = trimStop(reply.message);
        if (cursor === null) {
          rememberFirstPage(cacheRef.current, key, 0, { error });
        }
        return { error };
      }
      const page = readNoticePage(reply.data, role);
      if (cursor === null) {
        rememberFirstPage(cacheRef.current, key, 0, {
          items: page.items,
          total: page.next ? page.items.length + 1 : page.items.length,
        });
      }
      return { items: page.items, next: page.next };
    },
  });
  const filterKey = noticeListKey(filter, q, range.from, range.to);

  // First open of a filter may skeleton. Switching back restores that list and refreshes quietly.
  useFocusEffect(
    useCallback(() => {
      openCachedList(cacheRef.current, filterKey, list);
    }, [filterKey, list.clear, list.load, list.revise]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        list.load();
      }
    });
    return () => subscription.remove();
  }, [list.load]);

  useEffect(() => onHallRefresh(() => list.load()), [list.load]);

  const open = useCallback(
    (item: Notice) => {
      if (item.unread) {
        list.replaceRows(
          (current) => current?.map((row) => (row.id === item.id ? { ...row, unread: false } : row)) ?? null,
        );
        markNoticeReadInCache(cacheRef.current, item.id);
        void staffRequest(`${base}/${encodeURIComponent(item.id)}/read`, {}).then((reply) => {
          const count = reply.ok ? readUnreadCount(reply.data) : null;
          if (count !== null) {
            setBadge(count);
          } else {
            list.load();
          }
        });
      }
      if (item.target) {
        router.push(item.target as Href);
      }
    },
    [base, list.load, list.replaceRows, staffRequest],
  );

  const items = list.rows;
  const newest = items?.[0]?.at ?? null;
  const anyUnread = items?.some((item) => item.unread) ?? false;

  const markAll = useCallback(() => {
    if (!newest) {
      return;
    }
    list.replaceRows((current) => current?.map((row) => (row.at <= newest ? { ...row, unread: false } : row)) ?? null);
    markNoticesReadUpToInCache(cacheRef.current, newest);
    void staffRequest(`${base}/read`, { up_to: newest }).then((reply) => {
      const count = reply.ok ? readUnreadCount(reply.data) : null;
      if (count !== null) {
        setBadge(count);
      }
      if (count === null || filter === "unread") {
        list.load();
      }
    });
  }, [base, filter, list.load, list.replaceRows, newest, staffRequest]);

  const filtered = filter !== "all" || q.trim().length > 0 || range.from !== null || range.to !== null;

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => goBackOr(navigation, back)}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <View style={styles.titleRow}>
        <Text numberOfLines={1} style={[text.hallName, styles.heading, { color: colors.ink }]}>
          Notifications
        </Text>
        {anyUnread ? (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={markAll}>
            <Text numberOfLines={1} style={[text.label, { color: colors.forest }]}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>
      {staff ? <SearchField value={query} placeholder="Name or room" onChange={setQuery} /> : null}
      <FilterChipRow>
        {FILTERS.map((chip) => (
          <FilterChip
            key={chip.value}
            label={chip.label}
            on={filter === chip.value}
            onPress={() => setFilter(chip.value)}
          />
        ))}
      </FilterChipRow>
      {staff ? <DayRange value={range} onChange={setRange} /> : null}
    </View>
  );

  return (
    <PagedList
      kind="flat"
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
      rows={list.rows}
      data={list.showListSkeleton ? [] : (items ?? [])}
      error={list.error}
      pageError={list.pageError}
      showListSkeleton={list.showListSkeleton}
      showPageSkeleton={list.showPageSkeleton}
      onRetry={list.retry}
      onRetryPage={() => list.loadNext(true)}
      skeletonKind="card"
      header={header}
      empty={<EmptyState message={filtered ? "Nothing matches" : "No notifications in the last 90 days"} />}
      footer={
        !list.hasMore && items !== null && items.length > 0 && !staff ? (
          <Text style={[text.label, styles.footer, { color: colors.inkFaint }]}>Older history is under Settings</Text>
        ) : null
      }
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NoticeCard item={item} onPress={() => open(item)} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      onEndReached={() => list.loadNext()}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  header: { gap: 16, paddingBottom: 20 },
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  heading: { flex: 1, textAlign: "left" },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    alignItems: "stretch",
  },
  title: {
    alignSelf: "stretch",
    textAlign: "left",
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 17,
    lineHeight: 22,
  },
  detail: {
    alignSelf: "stretch",
    textAlign: "left",
    fontFamily: "SourceSans3_400Regular",
    fontSize: 15,
    lineHeight: 20,
  },
  status: {
    alignSelf: "stretch",
    textAlign: "left",
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  gap: { height: 12 },
  footer: { textAlign: "center", paddingTop: 20 },
  pressed: { opacity: 0.6 },
});
