import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { SearchField } from "@/components/search-field";
import { SectionHead } from "@/components/section-head";
import { EmptyState } from "@/components/list-state";
import { PagedList } from "@/components/paged-list";
import { ReviewSheet, type Fact } from "@/components/review-sheet";
import { pageQuery } from "@/list-page";
import { useListPage } from "@/use-list-page";
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

function permissionPath(kind: PermissionKind | null, blockId: string | null, offset: number, q = "") {
  const search = new URLSearchParams(pageQuery(offset));
  search.set("status", "pending");
  if (kind) {
    search.set("permission_type", kind);
  }
  return `/permissions?${filters(search, q, blockId)}`;
}

function guestPath(blockId: string | null, offset: number, q: string) {
  const search = new URLSearchParams(pageQuery(offset));
  search.set("bucket", "pending");
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
  const [open, setOpen] = useState<Item | null>(null);
  const [guestFacts, setGuestFacts] = useState<Fact[] | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decidedNote, setDecidedNote] = useState<string | null>(null);
  const list = useListPage<Item>({
    idOf: (item) => item.row.id,
    loadPage: async (offset) => {
      const reply = await staffRequest(
        tab === "permissions" ? permissionPath(kind, blockId, offset, q) : guestPath(blockId, offset, q),
      );
      if (!reply.ok) {
        return { error: trimStop(reply.message) };
      }
      const page: Item[] =
        tab === "permissions"
          ? readPermissionReviews(reply.data).map((row) => ({ tab: "permissions", row }))
          : readGuestReviews(reply.data).map((row) => ({ tab: "guests", row }));
      return { items: page, total: readTotal(reply.data) };
    },
  });

  const loadCounts = useCallback(async () => {
    const [summary, late, home, guests] = await Promise.all([
      staffRequest("/register/summary"),
      staffRequest(permissionPath("late_night", blockId, 0)),
      staffRequest(permissionPath("home_going", blockId, 0)),
      staffRequest(guestPath(blockId, 0, "")),
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

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    list.clear();
    list.load();
  }, [blockId, kind, q, tab, list.clear, list.load]);

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
      list.revise((state) => ({
        ...state,
        rows: (state.rows ?? []).filter((item) => item.row.id !== open.row.id),
        total: Math.max(0, state.total - 1),
      }));
      setOpen(null);
      void loadCounts();
    },
    [list.revise, loadCounts, open, staffRequest],
  );

  const rows = list.rows ?? [];
  const sections = useMemo(() => daySections(list.showListSkeleton ? [] : rows), [list.showListSkeleton, rows]);

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
    </View>
  );

  return (
    <>
      <PagedList<Item, Section>
        kind="section"
        style={[styles.screen, { backgroundColor: colors.paper }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: 28 }]}
        rows={list.rows}
        sections={sections}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        header={header}
        empty={<EmptyState message={q.trim() ? `Nothing matches ${q.trim()}` : "Nothing is waiting"} />}
        keyExtractor={(item) => item.row.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />}
        onEndReached={() => list.loadNext()}
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
