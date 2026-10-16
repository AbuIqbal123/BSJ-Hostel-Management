import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { SearchField } from "@/components/search-field";
import { SectionHead } from "@/components/section-head";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { ReviewSheet, type Fact } from "@/components/review-sheet";
import { SkeletonRows } from "@/components/skeleton";
import { acceptFailure, acceptPage, shouldRequestNext, type Listed } from "@/list-page";
import { formatHallDate, formatSpan, formatWhen } from "@/format-when";
import { kindLabel } from "@/requests";
import { useSession, type PermissionKind } from "@/session";
import {
  guestTime,
  permissionTime,
  readGuestDetail,
  readGuestReviews,
  readPermissionReviews,
  readSummary,
  readTotal,
  submittedDay,
  trimStop,
  type GuestReview,
  type HallBlock,
  type PermissionReview,
} from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PAGE = 50;

type Tab = "permissions" | "guests";
type Item = { tab: "permissions"; row: PermissionReview } | { tab: "guests"; row: GuestReview };
type Section = { key: string; title: string; data: Item[] };
type Counts = { permissions: number; guests: number; late: number; home: number };

function filters(search: URLSearchParams, q: string, blockId: string | null): string {
  if (q.trim()) {
    search.set("q", q.trim());
  }
  if (blockId) {
    search.set("block_id", blockId);
  }
  return search.toString();
}

function permissionPath(kind: PermissionKind | null, blockId: string | null, limit: number, offset: number, q = "") {
  const search = new URLSearchParams({ status: "pending", limit: String(limit), offset: String(offset) });
  if (kind) {
    search.set("permission_type", kind);
  }
  return `/permissions?${filters(search, q, blockId)}`;
}

function guestPath(blockId: string | null, limit: number, offset: number, q: string) {
  const search = new URLSearchParams({ bucket: "pending", limit: String(limit), offset: String(offset) });
  return `/guest-stays?${filters(search, q, blockId)}`;
}

function itemDay(item: Item): string {
  return item.tab === "permissions"
    ? submittedDay(item.row.createdAt)
    : `Arriving ${formatHallDate(item.row.start)}`;
}

function daySections(items: Item[]): Section[] {
  const sections: Section[] = [];
  for (const item of items) {
    const title = itemDay(item);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(item);
    } else {
      sections.push({ key: `${sections.length}-${title}`, title, data: [item] });
    }
  }
  return sections;
}

function permissionFacts(row: PermissionReview): Fact[] {
  const facts: Fact[] = [
    { label: "Place", value: row.detail ? `${row.place}, ${row.detail}` : row.place },
    { label: "When", value: formatSpan(row.departureAt, row.expectedReturnAt, row.kind === "home_going") },
    { label: "Reason", value: row.reason },
    { label: "Submitted", value: formatWhen(row.createdAt) },
  ];
  return facts.filter((fact) => fact.value.length > 0);
}

export default function RequestsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { staffRequest } = useSession();
  const params = useLocalSearchParams<{ tab?: string; open?: string; tap?: string }>();
  const [tab, setTab] = useState<Tab>("permissions");
  const [kind, setKind] = useState<PermissionKind | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<HallBlock[]>([]);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [list, setList] = useState<Listed<Item>>({ rows: null, total: 0, error: null, pageError: null });
  const [refreshing, setRefreshing] = useState(false);
  const [pagingUi, setPagingUi] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);
  const [guestFacts, setGuestFacts] = useState<Fact[] | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decidedNote, setDecidedNote] = useState<string | null>(null);
  const paging = useRef(false);
  const generation = useRef(0);

  const loadCounts = useCallback(async () => {
    const [summary, late, home, guests] = await Promise.all([
      staffRequest("/register/summary"),
      staffRequest(permissionPath("late_night", blockId, 1, 0)),
      staffRequest(permissionPath("home_going", blockId, 1, 0)),
      staffRequest(guestPath(blockId, 1, 0, "")),
    ]);
    const parsed = summary.ok ? readSummary(summary.data) : null;
    if (parsed) {
      setBlocks(parsed.blocks);
    }
    const lateCount = late.ok ? readTotal(late.data) : 0;
    const homeCount = home.ok ? readTotal(home.data) : 0;
    setCounts({
      permissions: blockId ? lateCount + homeCount : (parsed?.pendingPermissions ?? lateCount + homeCount),
      guests: guests.ok ? readTotal(guests.data) : (parsed?.pendingGuests ?? 0),
      late: lateCount,
      home: homeCount,
    });
  }, [blockId, staffRequest]);

  const loadPage = useCallback(
    async (offset: number, fromPull = false) => {
      if (offset > 0) {
        if (paging.current) {
          return;
        }
        paging.current = true;
        setPagingUi(true);
      }
      if (fromPull) {
        setRefreshing(true);
      }
      const run = generation.current;
      const reply = await staffRequest(
        tab === "permissions" ? permissionPath(kind, blockId, PAGE, offset, q) : guestPath(blockId, PAGE, offset, q),
      );
      if (offset > 0) {
        paging.current = false;
        setPagingUi(false);
      }
      if (fromPull) {
        setRefreshing(false);
      }
      if (run !== generation.current) {
        return;
      }
      if (!reply.ok) {
        const message = trimStop(reply.message);
        setList((state) => acceptFailure(state, offset, message));
        return;
      }
      const page: Item[] =
        tab === "permissions"
          ? readPermissionReviews(reply.data).map((row) => ({ tab: "permissions", row }))
          : readGuestReviews(reply.data).map((row) => ({ tab: "guests", row }));
      const total = readTotal(reply.data);
      setList((state) => acceptPage(state, offset, page, total, (item) => item.row.id));
    },
    [blockId, kind, q, staffRequest, tab],
  );

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    generation.current += 1;
    paging.current = false;
    setPagingUi(false);
    setList({ rows: null, total: 0, error: null, pageError: null });
    void loadPage(0);
  }, [loadPage]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const openItem = useCallback(
    (item: Item) => {
      setOpen(item);
      setSheetError(null);
      setGuestFacts(null);
      if (item.tab !== "guests") {
        return;
      }
      void staffRequest(`/guest-stays/${encodeURIComponent(item.row.id)}`).then((reply) => {
        const detail = reply.ok ? readGuestDetail(reply.data) : null;
        setGuestFacts([
          { label: "Host", value: `${item.row.hostName}, ${item.row.hostRoom}` },
          { label: "Relation", value: detail?.relation ?? "" },
          { label: "Dates", value: `${formatHallDate(item.row.start)} to ${formatHallDate(item.row.end)}` },
          { label: "Reason", value: detail?.reason ?? "" },
        ].filter((fact) => fact.value.length > 0));
      });
    },
    [staffRequest],
  );

  // A push or notification card opens one request straight into its review sheet, if it still waits.
  useEffect(() => {
    const id = typeof params.open === "string" ? params.open : "";
    if (!id) {
      return;
    }
    const guests = params.tab === "guests";
    setTab(guests ? "guests" : "permissions");
    void staffRequest(`${guests ? "/guest-stays" : "/permissions"}/${encodeURIComponent(id)}`).then((reply) => {
      if (!reply.ok) {
        return;
      }
      if ((reply.data as { status?: unknown } | null)?.status !== "pending") {
        setOpen(null);
        setDecidedNote("That request has already been decided");
        return;
      }
      setDecidedNote(null);
      const wrapped = { items: [reply.data] };
      const item: Item | undefined = guests
        ? readGuestReviews(wrapped).map((row) => ({ tab: "guests" as const, row }))[0]
        : readPermissionReviews(wrapped).map((row) => ({ tab: "permissions" as const, row }))[0];
      if (item) {
        openItem(item);
      }
    });
  }, [openItem, params.open, params.tab, params.tap, staffRequest]);

  const decide = useCallback(
    async (decision: "approved" | "rejected", note: string) => {
      if (!open) {
        return;
      }
      setBusy(true);
      const base = open.tab === "permissions" ? "/permissions" : "/guest-stays";
      const reply = await staffRequest(`${base}/${encodeURIComponent(open.row.id)}/decision`, {
        decision,
        note: note || null,
      });
      setBusy(false);
      if (!reply.ok) {
        setSheetError(trimStop(reply.message));
        return;
      }
      setList((state) => ({
        ...state,
        rows: (state.rows ?? []).filter((item) => item.row.id !== open.row.id),
        total: Math.max(0, state.total - 1),
      }));
      setOpen(null);
      void loadCounts();
    },
    [loadCounts, open, staffRequest],
  );

  const rows = list.rows ?? [];
  const sections = useMemo(() => daySections(rows), [rows]);

  const header = (
    <View style={styles.header}>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Requests</Text>
      {decidedNote ? (
        <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.inkSoft }]}>
          {decidedNote}
        </Text>
      ) : null}
      <View style={[styles.segment, { backgroundColor: colors.line }]}>
        {(["permissions", "guests"] as const).map((value) => {
          const on = tab === value;
          const count = value === "permissions" ? counts?.permissions : counts?.guests;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(value)}
              style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
            >
              <Text numberOfLines={1} style={[text.label, { color: on ? colors.ink : colors.inkSoft }]}>
                {`${value === "permissions" ? "Permissions" : "Guest stays"}${count === undefined ? "" : ` ${count}`}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SearchField
        value={query}
        placeholder={tab === "permissions" ? "Name or room" : "Guest, host or room"}
        onChange={setQuery}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {tab === "permissions" ? (
          <>
            <FilterChip label="All" on={kind === null} onPress={() => setKind(null)} />
            <FilterChip label={`Late-night ${counts?.late ?? ""}`.trim()} on={kind === "late_night"} onPress={() => setKind("late_night")} />
            <FilterChip label={`Home going ${counts?.home ?? ""}`.trim()} on={kind === "home_going"} onPress={() => setKind("home_going")} />
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
          </>
        ) : null}
        <FilterChip label="All blocks" on={blockId === null} onPress={() => setBlockId(null)} />
        {blocks.map((block) => (
          <FilterChip key={block.id} label={block.name} on={blockId === block.id} onPress={() => setBlockId(block.id)} />
        ))}
      </ScrollView>
      {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={() => void loadPage(0, true)} /> : null}
    </View>
  );

  return (
    <>
      <SectionList
        style={[styles.screen, { backgroundColor: colors.paper }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: 28 }]}
        sections={sections}
        keyExtractor={(item) => item.row.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        windowSize={9}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadPage(0, true)} tintColor={colors.inkFaint} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (shouldRequestNext(rows.length, list.total, paging.current, list.pageError !== null)) {
            void loadPage(rows.length);
          }
        }}
        renderSectionHeader={({ section }) => <SectionHead title={section.title} count={String(section.data.length)} />}
        renderItem={({ item, index, section }) => (
          <DenseRow
            title={item.tab === "permissions" ? item.row.name : item.row.guestName}
            detail={
              item.tab === "permissions"
                ? `${item.row.room} · ${kindLabel(item.row.kind)} · ${item.row.place}`
                : `${item.row.hostRoom} · Guest of ${item.row.hostName}`
            }
            time={item.tab === "permissions" ? permissionTime(item.row) : guestTime(item.row)}
            first={index === 0}
            last={index === section.data.length - 1}
            onPress={() => openItem(item)}
          />
        )}
        ListEmptyComponent={
          list.rows === null && !list.error ? (
            <SkeletonRows count={4} kind="row" />
          ) : list.error && rows.length === 0 ? (
            <ListError message={list.error} onRetry={() => void loadPage(0)} />
          ) : list.rows && rows.length === 0 ? (
            <EmptyState message={q.trim() ? `Nothing matches ${q.trim()}` : "Nothing is waiting"} />
          ) : null
        }
        ListFooterComponent={
          pagingUi ? (
            <SkeletonRows count={1} kind="row" />
          ) : list.pageError ? (
            <RetryRow message={list.pageError} onRetry={() => void loadPage(rows.length)} />
          ) : null
        }
      />
      {open ? (
        <ReviewSheet
          title={open.tab === "permissions" ? open.row.name : open.row.guestName}
          subtitle={
            open.tab === "permissions"
              ? `${open.row.room} · ${kindLabel(open.row.kind)}`
              : `Guest stay · ${open.row.hostRoom}`
          }
          facts={open.tab === "permissions" ? permissionFacts(open.row) : (guestFacts ?? [])}
          error={sheetError}
          busy={busy}
          onDecide={(decision, note) => void decide(decision, note)}
          onClose={() => setOpen(null)}
          extra={
            open.tab === "guests" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const stayId = open.row.id;
                  setOpen(null);
                  router.push({ pathname: "/staff/payments", params: { id: stayId } });
                }}
                style={styles.textButton}
              >
                <Text style={[text.button, { color: colors.forest }]}>Payment</Text>
              </Pressable>
            ) : null
          }
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  header: { gap: 16, paddingBottom: 8 },
  title: { textAlign: "left" },
  segment: { flexDirection: "row", borderRadius: 10, borderCurve: "continuous", padding: 2 },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  chips: { gap: 8, alignItems: "center" },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
  empty: { textAlign: "center", paddingTop: 96 },
  textButton: { minHeight: 44, justifyContent: "center" },
});
