import { useCallback, useEffect, useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { SectionHead } from "@/components/section-head";
import { useSession } from "@/session";
import {
  blockCode,
  dueLabel,
  lateBy,
  permissionOutRow,
  readOpenOuting,
  readOutRows,
  readPermissionReviews,
  readSummary,
  trimStop,
  type HallBlock,
  type OutingKind,
  type OutRow,
} from "@/staff";
import { kindLabel } from "@/requests";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type OutSection = { key: string; title: string; note: string; data: OutRow[] };
type View3 = "ordinary" | "permission" | "late";
type OutData = { late: OutRow[]; ordinary: OutRow[]; permission: OutRow[] };

const SOURCES: { value: OutingKind | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "ordinary", label: "Ordinary" },
  { value: "late_night", label: "Late-night" },
  { value: "home_going", label: "Home going" },
];

const VIEWS: { value: View3; label: string }[] = [
  { value: "ordinary", label: "Ordinary" },
  { value: "permission", label: "Permission" },
  { value: "late", label: "Late now" },
];

function byBackBy(a: OutRow, b: OutRow) {
  return a.sortKey.localeCompare(b.sortKey);
}

function matches(row: OutRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || row.name.toLowerCase().includes(q) || row.room.toLowerCase().includes(q);
}

/** Late is one list by due time; the others get one section per block, each by back-by time. */
function outSections(view: View3, data: OutData, blocks: HallBlock[]): OutSection[] {
  if (view === "late") {
    const late = [...data.late].sort(byBackBy);
    return late.length > 0 ? [{ key: "late", title: "Late", note: String(late.length), data: late }] : [];
  }
  const outside = data[view];
  const sections: OutSection[] = [];
  for (const block of blocks) {
    const members = outside.filter((row) => blockCode(row.room) === block.code).sort(byBackBy);
    if (members.length > 0) {
      sections.push({ key: block.id, title: block.name, note: `${members.length} out`, data: members });
    }
  }
  const known = new Set(blocks.map((block) => block.code));
  const other = outside.filter((row) => !known.has(blockCode(row.room))).sort(byBackBy);
  if (other.length > 0) {
    sections.push({ key: "other", title: "Other rooms", note: `${other.length} out`, data: other });
  }
  return sections;
}

export default function OutNowScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const [blocks, setBlocks] = useState<HallBlock[]>([]);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View3>("ordinary");
  const [rows, setRows] = useState<OutData | null>(null);
  const [lateKinds, setLateKinds] = useState<Record<string, { kind: OutingKind; dueAt: string }>>({});
  const [source, setSource] = useState<OutingKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void staffRequest("/register/summary").then((reply) => {
      if (reply.ok) {
        setBlocks(readSummary(reply.data)?.blocks ?? []);
      }
    });
  }, [staffRequest]);

  const load = useCallback(
    async (q: string, block: string | null) => {
      const params = (state: string) => {
        const search = new URLSearchParams({ state, limit: "500" });
        if (q.trim()) {
          search.set("q", q.trim());
        }
        if (block) {
          search.set("block_id", block);
        }
        return `/register/residents?${search.toString()}`;
      };
      const permits = new URLSearchParams({ status: "in_use", limit: "500" });
      if (block) {
        permits.set("block_id", block);
      }
      const [late, outside, inUse] = await Promise.all([
        staffRequest(params("late")),
        staffRequest(params("outside")),
        staffRequest(`/permissions?${permits.toString()}`),
      ]);
      if (!late.ok) {
        setError(trimStop(late.message));
        return;
      }
      if (!outside.ok) {
        setError(trimStop(outside.message));
        return;
      }
      if (!inUse.ok) {
        setError(trimStop(inUse.message));
        return;
      }
      setError(null);
      // The register row has no outing type. A resident out on an in-use permission is not ordinary.
      const permission = readPermissionReviews(inUse.data).map(permissionOutRow).filter((row) => matches(row, q));
      const onPermission = new Set(permission.map((row) => row.id));
      const outsideRows = readOutRows(outside.data, false);
      const lateRows = readOutRows(late.data, true);
      // The register row has no outing kind; each late resident's record carries her open outing.
      void Promise.all(
        lateRows.map(async (row) => {
          const reply = await staffRequest(`/register/residents/${encodeURIComponent(row.id)}`);
          return [row.id, reply.ok ? readOpenOuting(reply.data) : null] as const;
        }),
      ).then((pairs) => {
        const kinds: Record<string, { kind: OutingKind; dueAt: string }> = {};
        for (const [id, outing] of pairs) {
          if (outing) {
            kinds[id] = outing;
          }
        }
        setLateKinds(kinds);
      });
      setRows({
        late: lateRows,
        ordinary: outsideRows.filter((row) => !onPermission.has(row.id)),
        permission,
      });
    },
    [staffRequest],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(query, blockId), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [blockId, load, query]);

  const sections = useMemo(
    () => {
      if (!rows) {
        return [];
      }
      const late = rows.late.filter((row) => source === null || lateKinds[row.id]?.kind === source);
      return outSections(view, { ...rows, late }, blocks);
    },
    [blocks, lateKinds, rows, source, view],
  );
  const blockName = blocks.find((block) => block.id === blockId)?.name;

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
        {VIEWS.map((item) => {
          const on = view === item.value;
          const count = rows ? rows[item.value].length : null;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setView(item.value)}
              style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
            >
              <Text numberOfLines={1} style={[text.label, { color: on ? colors.ink : colors.inkSoft }]}>
                {count === null ? item.label : `${item.label} ${count}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Feather name="search" size={16} color={colors.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name or room"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[text.field, styles.searchInput, { color: colors.ink }]}
        />
      </View>
      {view === "late" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SOURCES.map((item) => (
            <FilterChip
              key={item.label}
              label={item.label}
              on={source === item.value}
              onPress={() => setSource(item.value)}
            />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <FilterChip label="All blocks" on={blockId === null} onPress={() => setBlockId(null)} />
        {blocks.map((block) => (
          <FilterChip key={block.id} label={block.name} on={blockId === block.id} onPress={() => setBlockId(block.id)} />
        ))}
      </ScrollView>
      {error ? <Text style={[text.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );

  return (
    <SectionList
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
      sections={sections}
      keyExtractor={(row) => row.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled
      initialNumToRender={20}
      windowSize={9}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderSectionHeader={({ section }) => <SectionHead title={section.title} count={section.note} />}
      renderItem={({ item, index, section }) => {
        const outing = item.late ? lateKinds[item.id] : undefined;
        return (
          <DenseRow
            title={item.name}
            detail={
              outing
                ? `${item.room} · ${outing.kind === "ordinary" ? "Ordinary" : kindLabel(outing.kind)} · ${dueLabel(outing.dueAt)}`
                : [item.room, item.place].filter(Boolean).join(" · ")
            }
            time={outing ? lateBy(outing.dueAt) : item.backBy}
            late={item.late}
            first={index === 0}
            last={index === section.data.length - 1}
          />
        );
      }}
      ListEmptyComponent={
        rows ? (
          <View style={styles.empty}>
            <Text style={[styles.place, { color: colors.ink }]}>
              {query || blockId ? "No one matches" : view === "late" ? "No one is late" : "No one is out"}
            </Text>
            {query || blockId ? (
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
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, height: "100%", paddingVertical: 0 },
  chips: { gap: 8 },
  empty: { alignItems: "center", gap: 8, paddingTop: 96 },
  place: { fontFamily: "SourceSerif4_600SemiBold", fontSize: 20, letterSpacing: -0.2 },
  center: { textAlign: "center" },
});
