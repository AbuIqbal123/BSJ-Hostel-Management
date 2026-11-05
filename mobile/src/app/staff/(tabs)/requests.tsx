import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterMark } from "@/components/filter-chip";
import { FilterChipRow } from "@/components/filter-chip-row";
import { SearchField } from "@/components/search-field";
import { SectionHead } from "@/components/section-head";
import { PagedList } from "@/components/paged-list";
import { PlainRow, RowHairline } from "@/components/plain-row";
import { ReviewSheet, type Fact } from "@/components/review-sheet";
import { useButtonFeedback } from "@/button-feedback";
import { pageQuery } from "@/list-page";
import { formatHallDate, formatSpan, formatWhen, formatWhenParts } from "@/format-when";
import { kindLabel } from "@/requests";
import { useSession, type PermissionKind } from "@/session";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";
import {
  decidesRequests,
  guestDecisionFacts,
  readGuestDetail,
  readGuestReviews,
  readPermissionReviews,
  readSummary,
  readTotal,
  shortDay,
  shouldRemoveGuestAfterDecision,
  submittedDay,
  trimStop,
  type GuestDetail,
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

function requestListKey(tab: Tab, kind: PermissionKind | null, blockId: string | null, q: string): string {
  return `${tab}|${kind ?? ""}|${blockId ?? ""}|${q.trim().slice(0, 80)}`;
}

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

function timeLines(item: Item): readonly [string, string] {
  if (item.tab === "guests") {
    return [shortDay(formatHallDate(item.row.start)), `to ${shortDay(formatHallDate(item.row.end))}`];
  }
  const start = formatWhenParts(item.row.departureAt);
  const end = formatWhenParts(item.row.expectedReturnAt);
  if (!start || !end) {
    return ["", ""];
  }
  if (item.row.kind === "home_going") {
    return [shortDay(start.day), `to ${shortDay(end.day)}`];
  }
  return [shortDay(start.day), start.clock];
}

function detailParts(item: Item, kind: PermissionKind | null): string[] {
  if (item.tab === "guests") {
    return [item.row.hostRoom, `Guest of ${item.row.hostName}`];
  }
  const parts = [item.row.room];
  if (kind !== "late_night") {
    parts.push(kindLabel(item.row.kind));
  }
  parts.push(item.row.place);
  return parts.filter((part) => part.length > 0);
}

function responseStatus(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }
  const status = (value as { status?: unknown }).status;
  return typeof status === "string" ? status : "";
}

function guestSheetFacts(row: GuestReview, detail: GuestDetail | null): Fact[] {
  return [
    { label: "Host", value: `${row.hostName}, ${row.hostRoom}` },
    { label: "Relation", value: detail?.relation ?? "" },
    { label: "Dates", value: `${formatHallDate(row.start)} to ${formatHallDate(row.end)}` },
    { label: "Reason", value: detail?.reason ?? "" },
    ...(detail ? guestDecisionFacts(detail) : []),
  ].filter((fact) => fact.value.length > 0);
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
  const { user, staffRequest } = useSession();
  const canDecide = user !== null && decidesRequests(user.role);
  const params = useLocalSearchParams<{ tab?: string; open?: string; tap?: string }>();
  const [tab, setTab] = useState<Tab>("permissions");
  const [kind, setKind] = useState<PermissionKind | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<HallBlock[]>([]);
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [, setCounts] = useState<Counts | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const [guestFacts, setGuestFacts] = useState<Fact[] | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const decideCue = useButtonFeedback();
  const [decidedNote, setDecidedNote] = useState<string | null>(null);
  const guestDetailEpoch = useRef(0);
  type RequestFilters = {
    tab: Tab;
    kind: PermissionKind | null;
    blockId: string | null;
    q: string;
  };
  const filters = useMemo<RequestFilters>(
    () => ({ tab, kind, blockId, q }),
    [tab, kind, blockId, q],
  );
  const list = useFilteredPagedList<Item, RequestFilters>({
    idOf: (item) => item.row.id,
    filters,
    filterKey: requestListKey(tab, kind, blockId, q),
    loadPage: useCallback(async (current, offset) => {
      const reply = await staffRequest(
        current.tab === "permissions"
          ? permissionPath(current.kind, current.blockId, offset, current.q)
          : guestPath(current.blockId, offset, current.q),
      );
      if (!reply.ok) {
        return { error: trimStop(reply.message) };
      }
      const page: Item[] =
        current.tab === "permissions"
          ? readPermissionReviews(reply.data).map((row) => ({ tab: "permissions", row }))
          : readGuestReviews(reply.data).map((row) => ({ tab: "guests", row }));
      return { items: page, total: readTotal(reply.data) };
    }, [staffRequest]),
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
      const epoch = ++guestDetailEpoch.current;
      void staffRequest(`/guest-stays/${encodeURIComponent(item.row.id)}`).then((reply) => {
        if (epoch !== guestDetailEpoch.current) {
          return;
        }
        const detail = reply.ok ? readGuestDetail(reply.data) : null;
        setGuestFacts(guestSheetFacts(item.row, detail));
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
      if (!open || decideCue.held) {
        return;
      }
      decideCue.markBusy();
      setSheetError(null);
      const base = open.tab === "permissions" ? "/permissions" : "/guest-stays";
      const reply = await staffRequest(`${base}/${encodeURIComponent(open.row.id)}/decision`, {
        decision,
        note: note || null,
      });
      if (!reply.ok) {
        setSheetError(trimStop(reply.message));
        decideCue.markFailure();
        return;
      }
      if (open.tab === "guests" && !shouldRemoveGuestAfterDecision(responseStatus(reply.data))) {
        const detail = readGuestDetail(reply.data);
        if (detail) {
          guestDetailEpoch.current += 1;
          setGuestFacts(guestSheetFacts(open.row, detail));
        }
        decideCue.markSuccess();
        return;
      }
      decideCue.markSuccess(() => {
        list.revise((state) => {
          const rows = (state.rows ?? []).filter((item) => item.row.id !== open.row.id);
          const total = Math.max(0, state.total - 1);
          list.remember(requestListKey(tab, kind, blockId, q), {
            rows,
            total,
            error: null,
          });
          return { ...state, rows, total };
        });
        setOpen(null);
        void loadCounts();
      });
    },
    [blockId, decideCue, kind, list, loadCounts, open, q, staffRequest, tab],
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
      <View style={styles.segment}>
        {(["permissions", "guests"] as const).map((value) => {
          const on = tab === value;
          const label = value === "permissions" ? "Permissions" : "Guest stays";
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(value)}
              style={styles.segmentItem}
            >
              <Text numberOfLines={1} style={[text.label, { color: on ? colors.forest : colors.inkSoft }]}>
                {label}
              </Text>
              <View style={[styles.segmentMark, { backgroundColor: on ? colors.forest : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>
      <SearchField
        value={query}
        placeholder={tab === "permissions" ? "Name or room" : "Guest, host or room"}
        onChange={setQuery}
      />
      <FilterChipRow contentStyle={styles.chips}>
        {tab === "permissions" ? (
          <>
            <FilterMark label="All" on={kind === null} onPress={() => setKind(null)} />
            <FilterMark label="Late-night" on={kind === "late_night"} onPress={() => setKind("late_night")} />
            <FilterMark label="Home going" on={kind === "home_going"} onPress={() => setKind("home_going")} />
            <View style={[styles.divider, { backgroundColor: colors.line }]} />
          </>
        ) : null}
        <FilterMark label="All blocks" on={blockId === null} onPress={() => setBlockId(null)} />
        {blocks.map((block) => (
          <FilterMark key={block.id} label={block.name} on={blockId === block.id} onPress={() => setBlockId(block.id)} />
        ))}
      </FilterChipRow>
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
        empty={
          <Text style={[styles.emptyLine, { color: colors.inkFaint }]}>
            {q.trim() ? `Nothing matches ${q.trim()}` : "Nothing is waiting"}
          </Text>
        }
        keyExtractor={(item) => item.row.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />}
        onEndReached={() => list.loadNext()}
        renderSectionHeader={({ section }) => <SectionHead title={section.title} padTop={16} />}
        renderItem={({ item, index }) => {
          const name = item.tab === "permissions" ? item.row.name : item.row.guestName;
          const parts = detailParts(item, kind);
          const time = timeLines(item);
          return (
            <View>
              {index > 0 ? <RowHairline /> : null}
              <PlainRow
                title={name}
                parts={parts}
                keepParts={parts.length > 1 ? parts.length - 1 : undefined}
                time={time}
                onPress={() => openItem(item)}
                label={`${name}. ${parts.join(", ")}. ${time.join(" ")}`}
              />
            </View>
          );
        }}
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
          busy={decideCue.busy}
          succeeded={decideCue.succeeded}
          onDecide={canDecide ? (decision, note) => void decide(decision, note) : undefined}
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
  segment: { flexDirection: "row", minHeight: 40 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  segmentMark: { alignSelf: "stretch", height: 2, borderRadius: 1 },
  chips: { gap: 18, alignItems: "flex-end" },
  divider: { width: StyleSheet.hairlineWidth, height: 20, marginHorizontal: 4 },
  emptyLine: {
    marginTop: 16,
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
    lineHeight: 22,
  },
  textButton: { minHeight: 44, justifyContent: "center" },
});
