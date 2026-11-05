import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { DayRange, type DayRangeValue } from "@/components/day-range";
import { DenseRow } from "@/components/dense-row";
import { FilterChip } from "@/components/filter-chip";
import { FilterChipRow } from "@/components/filter-chip-row";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { formatWhenParts } from "@/format-when";
import { pageQuery } from "@/list-page";
import { readAudit, readPage, type AuditRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";

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

type AuditFilters = {
  entityType: string | null;
  q: string;
  range: DayRangeValue;
};

function auditKey(filters: AuditFilters): string {
  return `${filters.entityType ?? ""}|${filters.q}|${filters.range.from ?? ""}|${filters.range.to ?? ""}`;
}

function auditPath(filters: AuditFilters, offset: number): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (filters.entityType) {
    search.set("entity_type", filters.entityType);
  }
  if (filters.q.trim()) {
    search.set("q", filters.q.trim());
  }
  if (filters.range.from) {
    search.set("from", filters.range.from);
  }
  if (filters.range.to) {
    search.set("to", filters.range.to);
  }
  return `/admin/audit?${search.toString()}`;
}

export default function OfficeAudit() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const filters = useMemo<AuditFilters>(() => ({ entityType, q, range }), [entityType, q, range]);

  const list = useFilteredPagedList<AuditRow, AuditFilters>({
    idOf: (row) => row.id,
    filters,
    filterKey: auditKey(filters),
    cacheScope: "office-audit",
    loadPage: useCallback(async (current, offset) => {
      const reply = await staffRequest(auditPath(current, offset));
      const page = reply.ok ? readPage(reply.data, readAudit) : null;
      if (!page) {
        return { error: replyError(reply) ?? "The audit log didn't load" };
      }
      return { items: page.items, total: page.total };
    }, [staffRequest]),
  });

  const rows = list.rows ?? [];
  const selected = rows.find((row) => row.id === open) ?? null;

  return (
    <OfficeFrame title="Audit" refreshing={list.refreshing} onRefresh={list.refresh} onNearEnd={() => list.loadNext()}>
      <SearchField value={query} placeholder="Summary, action, or actor" onChange={setQuery} />
      <FilterChipRow>
        {ENTITY_TYPES.map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={entityType === item.value}
            onPress={() => setEntityType(item.value)}
          />
        ))}
      </FilterChipRow>
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
