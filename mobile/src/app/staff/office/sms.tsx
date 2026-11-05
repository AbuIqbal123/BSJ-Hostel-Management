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
import { noticeLabel, readPage, readSms, type SmsRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";

type NoticeFilter = "late_notice" | "return_notice" | null;
type StatusFilter = "sent" | "failed" | null;

type SmsFilters = {
  notice: NoticeFilter;
  status: StatusFilter;
  q: string;
  range: DayRangeValue;
};

function smsKey(filters: SmsFilters): string {
  return `${filters.notice ?? ""}|${filters.status ?? ""}|${filters.q}|${filters.range.from ?? ""}|${filters.range.to ?? ""}`;
}

function smsPath(filters: SmsFilters, offset: number): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (filters.notice) {
    search.set("notice_type", filters.notice);
  }
  if (filters.status) {
    search.set("status", filters.status);
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
  return `/admin/sms?${search.toString()}`;
}

export default function OfficeSms() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [notice, setNotice] = useState<NoticeFilter>(null);
  const [status, setStatus] = useState<StatusFilter>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const filters = useMemo<SmsFilters>(() => ({ notice, status, q, range }), [notice, status, q, range]);

  const list = useFilteredPagedList<SmsRow, SmsFilters>({
    idOf: (row) => row.id,
    filters,
    filterKey: smsKey(filters),
    cacheScope: "office-sms",
    loadPage: useCallback(async (current, offset) => {
      const reply = await staffRequest(smsPath(current, offset));
      const page = reply.ok ? readPage(reply.data, readSms) : null;
      if (!page) {
        return { error: replyError(reply) ?? "Texts didn't load" };
      }
      return { items: page.items, total: page.total };
    }, [staffRequest]),
  });

  const rows = list.rows ?? [];
  const selected = rows.find((row) => row.id === open) ?? null;

  return (
    <OfficeFrame
      title="Text messages"
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onNearEnd={() => list.loadNext()}
    >
      <SearchField value={query} placeholder="Name, phone, or text" onChange={setQuery} />
      <FilterChipRow>
        {(
          [
            { value: null, label: "All notices" },
            { value: "late_notice" as const, label: "Late" },
            { value: "return_notice" as const, label: "Return" },
          ] as const
        ).map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={notice === item.value}
            onPress={() => setNotice(item.value)}
          />
        ))}
        {(
          [
            { value: null, label: "Any status" },
            { value: "sent" as const, label: "Sent" },
            { value: "failed" as const, label: "Failed" },
          ] as const
        ).map((item) => (
          <FilterChip
            key={item.label}
            label={item.label}
            on={status === item.value}
            onPress={() => setStatus(item.value)}
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
        empty="No matching texts"
      >
        {!list.showListSkeleton && selected ? (
          <View style={{ gap: 8 }}>
            <Text selectable style={[text.body, { color: colors.ink }]}>
              {selected.body}
            </Text>
            <Text style={[text.error, { color: colors.inkSoft }]}>{selected.phone}</Text>
          </View>
        ) : null}
        <View>
          {rows.map((row, index, all) => {
            const when = formatWhenParts(row.at);
            return (
              <DenseRow
                key={row.id}
                title={row.residentName ?? noticeLabel(row.notice)}
                detail={`${noticeLabel(row.notice)} · ${row.status === "sent" ? "Sent" : "Failed"}${when ? ` · ${when.day}` : ""}`}
                time={when?.clock ?? ""}
                late={row.status === "failed"}
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
