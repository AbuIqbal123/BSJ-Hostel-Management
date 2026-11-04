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
import { noticeLabel, readPage, readSms, type SmsRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useListPage } from "@/use-list-page";

type NoticeFilter = "late_notice" | "return_notice" | null;
type StatusFilter = "sent" | "failed" | null;

function smsKey(notice: NoticeFilter, status: StatusFilter, q: string, range: DayRangeValue): string {
  return `${notice ?? ""}|${status ?? ""}|${q}|${range.from ?? ""}|${range.to ?? ""}`;
}

function smsPath(
  notice: NoticeFilter,
  status: StatusFilter,
  q: string,
  range: DayRangeValue,
  offset: number,
): string {
  const search = new URLSearchParams(pageQuery(offset));
  if (notice) {
    search.set("notice_type", notice);
  }
  if (status) {
    search.set("status", status);
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
  return `/admin/sms?${search.toString()}`;
}

export default function OfficeSms() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<NoticeFilter>(null);
  const [status, setStatus] = useState<StatusFilter>(null);
  const [range, setRange] = useState<DayRangeValue>({ from: null, to: null });
  const qRef = useRef(q);
  const noticeRef = useRef(notice);
  const statusRef = useRef(status);
  const rangeRef = useRef(range);
  const cacheRef = useRef(new Map<string, ListSnapshot<SmsRow>>());
  qRef.current = q;
  noticeRef.current = notice;
  statusRef.current = status;
  rangeRef.current = range;

  const list = useListPage<SmsRow>({
    idOf: (row) => row.id,
    loadPage: async (offset) => {
      const reply = await staffRequest(
        smsPath(noticeRef.current, statusRef.current, qRef.current, rangeRef.current, offset),
      );
      const page = reply.ok ? readPage(reply.data, readSms) : null;
      if (!page) {
        return { error: replyError(reply) ?? "Texts didn't load" };
      }
      const result = { items: page.items, total: page.total };
      rememberFirstPage(
        cacheRef.current,
        smsKey(noticeRef.current, statusRef.current, qRef.current, rangeRef.current),
        offset,
        result,
      );
      return result;
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    openCachedList(cacheRef.current, smsKey(notice, status, q, range), list);
  }, [notice, status, q, range, list.clear, list.load, list.revise]);

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
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
