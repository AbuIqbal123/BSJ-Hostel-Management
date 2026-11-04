import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { DayRange, type DayRangeValue } from "@/components/day-range";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { formatWhenParts } from "@/format-when";
import { openCachedList, rememberFirstPage, type ListSnapshot } from "@/list-cache";
import { pageQuery } from "@/list-page";
import { readAudit, readPage, type AuditRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useListPage } from "@/use-list-page";

const ENTITY_TYPES: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "resident", label: "Resident" },
  { value: "staff", label: "Staff" },
  { value: "room", label: "Room" },
  { value: "block", label: "Block" },
  { value: "guest_stay", label: "Guest stay" },
  { value: "permission", label: "Permission" },
  { value: "outing", label: "Outing" },
  { value: "settings", label: "Settings" },
  { value: "destination", label: "Destination" },
];

function auditKey(entityType: string | null, q: string, range: DayRangeValue): string {
  return `${entityType ?? ""}|${q}|${range.from ?? ""}|${range.to ?? ""}`;
}

function auditPath(entityType: string | null, q: string, range: DayRangeValue, offset: number): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (entityType) {
    search.set("entity_type", entityType);
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
  return `/admin/audit?${search.toString()}`;
}

export default function OfficeAudit() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState<string | null>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const qRef = useRef(q);
  const entityRef = useRef(entityType);
  const rangeRef = useRef(range);
  const cacheRef = useRef(new Map<string, ListSnapshot<AuditRow>>());
  qRef.current = q;
  entityRef.current = entityType;
  rangeRef.current = range;

  const list = useListPage<AuditRow>({
    idOf: (row) => row.id,
    loadPage: async (offset) => {
      const reply = await staffRequest(auditPath(entityRef.current, qRef.current, rangeRef.current, offset));
      const page = reply.ok ? readPage(reply.data, readAudit) : null;
      if (!page) {
        return { error: replyError(reply) ?? "The audit log didn't load" };
      }
      const result = { items: page.items, total: page.total };
      rememberFirstPage(cacheRef.current, auditKey(entityRef.current, qRef.current, rangeRef.current), offset, result);
      return result;
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    openCachedList(cacheRef.current, auditKey(entityType, q, range), list);
  }, [entityType, q, range, list.clear, list.load, list.revise]);

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const rows = list.rows ?? [];
  const selected = rows.find((row) => row.id === open) ?? null;

  return (
    <OfficeFrame title="Audit" refreshing={list.refreshing} onRefresh={list.refresh} onNearEnd={() => list.loadNext()}>
      <SearchField value={query} placeholder="Summary, action, or actor" onChange={setQuery} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {ENTITY_TYPES.map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={entityType === item.value}
            onPress={() => setEntityType(item.value)}
          />
        ))}
      </ScrollView>
      <DayRange value={range} onChange={setRange} />
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        filling={list.filling}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        empty="No matching audit lines"
      >
        {!list.showListSkeleton && selected ? (
          <Text selectable style={[text.body, { color: colors.ink }]}>
            {selected.summary}
          </Text>
        ) : null}
        <View>
          {rows.map((row, index, all) => {
            const when = formatWhenParts(row.at);
            return (
              <DenseRow
                key={row.id}
                title={row.summary}
                detail={`${row.actor ?? "Hall"}${when ? ` · ${when.day}` : ""}`}
                time={when?.clock ?? ""}
                first={index === 0}
                last={index === all.length - 1}
                onPress={() => setOpen(row.id === open ? null : row.id)}
              />
            );
          })}
        </View>
      </PagedList>
    </OfficeFrame>
  );
}
