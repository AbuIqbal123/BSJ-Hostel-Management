import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DayRange, type DayRangeValue } from "@/components/day-range";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { SearchField } from "@/components/search-field";
import { SectionHead } from "@/components/section-head";
import { useSession } from "@/session";
import {
  lateDetail,
  lateFor,
  readLateReturns,
  readOutRows,
  readSummary,
  readTotal,
  trimStop,
  type HallBlock,
  type LateReturn,
  type OutingKind,
  type OutRow,
} from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PAGE = 50;

type Tab = "ordinary" | "permission" | "late";
type LateState = "now" | "past";
type Row = { tab: "out"; row: OutRow } | { tab: "late"; row: LateReturn };
type OutSection = { key: string; title: string; note: string; data: Row[] };

const SOURCES: { value: OutingKind | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "ordinary", label: "Ordinary" },
  { value: "late_night", label: "Late-night" },
  { value: "home_going", label: "Home going" },
];

const TABS: { value: Tab; label: string }[] = [
  { value: "ordinary", label: "Ordinary" },
  { value: "permission", label: "Permission" },
  { value: "late", label: "Late" },
];

function outPath(q: string, blockId: string | null): string {
  const search = new URLSearchParams({ state: "outside", order: "back_by", limit: "500" });
  if (q.trim()) {
    search.set("q", q.trim());
  }
  if (blockId) {
    search.set("block_id", blockId);
  }
  return `/register/residents?${search.toString()}`;
}

function latePath(state: LateState, source: OutingKind | null, range: DayRangeValue, offset: number): string {
  const search = new URLSearchParams({ state, limit: String(PAGE), offset: String(offset) });
  if (source) {
    search.set("source", source);
  }
  if (state === "past" && range.from) {
    search.set("from", range.from);
  }
  if (state === "past" && range.to) {
    search.set("to", range.to);
  }
  return `/register/late-returns?${search.toString()}`;
}

/** On-time rows arrive ordered by back-by; keep that order inside one section per block. */
function blockSections(rows: OutRow[], blocks: HallBlock[]): OutSection[] {
  const names = [...blocks.map((block) => block.name), ...rows.map((row) => row.block)];
  return [...new Set(names)].flatMap((name) => {
    const data = rows.filter((row) => row.block === name).map((row): Row => ({ tab: "out", row }));
    return data.length > 0 ? [{ key: name, title: name || "Other rooms", note: `${data.length} out`, data }] : [];
  });
}

export default function OutNowScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [blocks, setBlocks] = useState<HallBlock[]>([]);
  const [lateCount, setLateCount] = useState<number | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>(params.tab === "late" ? "late" : "ordinary");
  const [outRows, setOutRows] = useState<OutRow[] | null>(null);
  const [lateState, setLateState] = useState<LateState>("now");
  const [source, setSource] = useState<OutingKind | null>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const [late, setLate] = useState<LateReturn[] | null>(null);
  const [lateTotal, setLateTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const outGen = useRef(0);

  useEffect(() => {
    if (params.tab === "late") {
      setTab("late");
    }
  }, [params.tab]);
  const lateGen = useRef(0);
  const lateLoading = useRef(false);

  useEffect(() => {
    void staffRequest("/register/summary").then((reply) => {
      const summary = reply.ok ? readSummary(reply.data) : null;
      if (summary) {
        setBlocks(summary.blocks);
        setLateCount(summary.late);
      }
    });
  }, [staffRequest]);

  const loadOut = useCallback(
    async (q: string, block: string | null) => {
      const run = ++outGen.current;
      const reply = await staffRequest(outPath(q, block));
      if (run !== outGen.current) {
        return;
      }
      if (!reply.ok) {
        setError(trimStop(reply.message));
        return;
      }
      setError(null);
      setOutRows(readOutRows(reply.data));
    },
    [staffRequest],
  );

  const loadLate = useCallback(
    async (offset: number) => {
      if (offset > 0 && lateLoading.current) {
        return;
      }
      lateLoading.current = true;
      const run = offset === 0 ? ++lateGen.current : lateGen.current;
      const reply = await staffRequest(latePath(lateState, source, range, offset));
      lateLoading.current = false;
      if (run !== lateGen.current) {
        return;
      }
      if (!reply.ok) {
        setError(trimStop(reply.message));
        return;
      }
      setError(null);
      const page = readLateReturns(reply.data);
      setLateTotal(readTotal(reply.data));
      setLate((current) => (offset === 0 || !current ? page : [...current, ...page]));
    },
    [lateState, range, source, staffRequest],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadOut(query, blockId), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [blockId, loadOut, query]);

  useEffect(() => {
    if (tab === "late") {
      void loadLate(0);
    }
  }, [loadLate, tab]);

  const sections = useMemo((): OutSection[] => {
    if (tab === "late") {
      const data = (late ?? []).map((row): Row => ({ tab: "late", row }));
      const title = lateState === "now" ? "Still out" : "Came back late";
      return data.length > 0 ? [{ key: "late", title, note: String(lateTotal), data }] : [];
    }
    const wanted = (outRows ?? []).filter((row) => (tab === "ordinary") === (row.kind === "ordinary"));
    return blockSections(wanted, blocks);
  }, [blocks, late, lateState, lateTotal, outRows, tab]);

  const count = (value: Tab): number | null => {
    if (value === "late") {
      return lateCount;
    }
    return outRows ? outRows.filter((row) => (value === "ordinary") === (row.kind === "ordinary")).length : null;
  };
  const filtered = tab === "late" ? source !== null || range.from !== null || range.to !== null : query !== "" || blockId !== null;
  const blockName = blocks.find((block) => block.id === blockId)?.name;
  const loaded = tab === "late" ? late !== null : outRows !== null;

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => goBackOr(navigation, "/staff")}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Out now</Text>
      <View style={[styles.segment, { backgroundColor: colors.line }]}>
        {TABS.map((item) => {
          const on = tab === item.value;
          const n = count(item.value);
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(item.value)}
              style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
            >
              <Text numberOfLines={1} style={[text.label, { color: on ? colors.ink : colors.inkSoft }]}>
                {n === null ? item.label : `${item.label} ${n}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {tab === "late" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <FilterChip label="Still out" on={lateState === "now"} onPress={() => setLateState("now")} />
            <FilterChip label="Came back late" on={lateState === "past"} onPress={() => setLateState("past")} />
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
            {SOURCES.map((item) => (
              <FilterChip key={item.label} label={item.label} on={source === item.value} onPress={() => setSource(item.value)} />
            ))}
          </ScrollView>
          {lateState === "past" ? <DayRange value={range} onChange={setRange} /> : null}
        </>
      ) : (
        <>
          <SearchField value={query} placeholder="Name or room" onChange={setQuery} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <FilterChip label="All blocks" on={blockId === null} onPress={() => setBlockId(null)} />
            {blocks.map((block) => (
              <FilterChip key={block.id} label={block.name} on={blockId === block.id} onPress={() => setBlockId(block.id)} />
            ))}
          </ScrollView>
        </>
      )}
      {error ? <Text accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );

  const emptyTitle = filtered
    ? "No one matches"
    : tab === "late"
      ? lateState === "now"
        ? "No one is late"
        : "No late returns"
      : "No one is out";

  return (
    <SectionList
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
      sections={sections}
      keyExtractor={(item) => item.row.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled
      initialNumToRender={20}
      windowSize={9}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (tab === "late" && late && late.length < lateTotal) {
          void loadLate(late.length);
        }
      }}
      renderSectionHeader={({ section }) => <SectionHead title={section.title} count={section.note} />}
      renderItem={({ item, index, section }) => (
        <DenseRow
          title={item.row.name}
          detail={item.tab === "late" ? lateDetail(item.row) : [item.row.room, item.row.place].filter(Boolean).join(" · ")}
          time={item.tab === "late" ? lateFor(item.row.minutesLate) : item.row.backBy}
          late={item.tab === "late"}
          first={index === 0}
          last={index === section.data.length - 1}
        />
      )}
      ListEmptyComponent={
        loaded && !error ? (
          <View style={styles.empty}>
            <Text style={[styles.place, { color: colors.ink }]}>{emptyTitle}</Text>
            {filtered && tab !== "late" ? (
              <Text numberOfLines={2} style={[text.body, styles.center, { color: colors.inkSoft }]}>
                {`No one out${blockName ? ` in ${blockName}` : ""}${query ? ` matches ${query.trim()}` : ""}`}
              </Text>
            ) : null}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  header: { gap: 16, paddingBottom: 8 },
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  title: { textAlign: "left" },
  segment: { flexDirection: "row", borderRadius: 10, borderCurve: "continuous", padding: 2 },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  chips: { gap: 8, alignItems: "center" },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
  empty: { alignItems: "center", gap: 8, paddingTop: 96 },
  place: { fontFamily: "SourceSerif4_600SemiBold", fontSize: 20, letterSpacing: -0.2 },
  center: { textAlign: "center" },
});
