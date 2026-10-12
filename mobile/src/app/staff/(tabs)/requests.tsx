import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { SectionHead } from "@/components/section-head";
import { ReviewSheet, type Fact } from "@/components/review-sheet";
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

function permissionPath(kind: PermissionKind | null, blockId: string | null, limit: number, offset: number) {
  const search = new URLSearchParams({ status: "pending", limit: String(limit), offset: String(offset) });
  if (kind) {
    search.set("permission_type", kind);
  }
  if (blockId) {
    search.set("block_id", blockId);
  }
  return `/permissions?${search.toString()}`;
}

function guestPath(limit: number, offset: number) {
  return `/guest-stays?bucket=pending&limit=${limit}&offset=${offset}`;
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
  const [tab, setTab] = useState<Tab>("permissions");
  const [kind, setKind] = useState<PermissionKind | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<HallBlock[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const [guestFacts, setGuestFacts] = useState<Fact[] | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loading = useRef(false);
  const generation = useRef(0);

  const loadCounts = useCallback(async () => {
    const [summary, late, home] = await Promise.all([
      staffRequest("/register/summary"),
      staffRequest(permissionPath("late_night", blockId, 1, 0)),
      staffRequest(permissionPath("home_going", blockId, 1, 0)),
    ]);
    const parsed = summary.ok ? readSummary(summary.data) : null;
    if (parsed) {
      setBlocks(parsed.blocks);
    }
    const lateCount = late.ok ? readTotal(late.data) : 0;
    const homeCount = home.ok ? readTotal(home.data) : 0;
    setCounts({
      permissions: blockId ? lateCount + homeCount : (parsed?.pendingPermissions ?? lateCount + homeCount),
      guests: parsed?.pendingGuests ?? 0,
      late: lateCount,
      home: homeCount,
    });
  }, [blockId, staffRequest]);

  const loadPage = useCallback(
    async (offset: number) => {
      if (loading.current) {
        return;
      }
      loading.current = true;
      const run = generation.current;
      const reply = await staffRequest(
        tab === "permissions" ? permissionPath(kind, blockId, PAGE, offset) : guestPath(PAGE, offset),
      );
      loading.current = false;
      if (run !== generation.current) {
        return;
      }
      setLoaded(true);
      if (!reply.ok) {
        setError(trimStop(reply.message));
        return;
      }
      setError(null);
      const page: Item[] =
        tab === "permissions"
          ? readPermissionReviews(reply.data).map((row) => ({ tab: "permissions", row }))
          : readGuestReviews(reply.data).map((row) => ({ tab: "guests", row }));
      setTotal(readTotal(reply.data));
      setItems((current) => (offset === 0 ? page : [...current, ...page]));
    },
    [blockId, kind, staffRequest, tab],
  );

  useEffect(() => {
    generation.current += 1;
    loading.current = false;
    setItems([]);
    setLoaded(false);
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
      setItems((current) => current.filter((item) => item.row.id !== open.row.id));
      setTotal((current) => Math.max(0, current - 1));
      setOpen(null);
      void loadCounts();
    },
    [loadCounts, open, staffRequest],
  );

  const sections = useMemo(() => daySections(items), [items]);

  const header = (
    <View style={styles.header}>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Requests</Text>
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
      {tab === "permissions" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="All" on={kind === null} onPress={() => setKind(null)} />
          <FilterChip label={`Late-night ${counts?.late ?? ""}`.trim()} on={kind === "late_night"} onPress={() => setKind("late_night")} />
          <FilterChip label={`Home going ${counts?.home ?? ""}`.trim()} on={kind === "home_going"} onPress={() => setKind("home_going")} />
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <FilterChip label="All blocks" on={blockId === null} onPress={() => setBlockId(null)} />
          {blocks.map((block) => (
            <FilterChip key={block.id} label={block.name} on={blockId === block.id} onPress={() => setBlockId(block.id)} />
          ))}
        </ScrollView>
      ) : null}
      {error ? <Text style={[text.error, { color: colors.danger }]}>{error}</Text> : null}
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
        initialNumToRender={20}
        windowSize={9}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (items.length < total) {
            void loadPage(items.length);
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
          loaded && !error ? (
            <Text style={[text.body, styles.empty, { color: colors.inkSoft }]}>Nothing is waiting</Text>
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
});
