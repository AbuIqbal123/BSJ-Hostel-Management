import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState } from "@/components/list-state";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { openCachedList, rememberFirstPage, type ListSnapshot } from "@/list-cache";
import { pageQuery } from "@/list-page";
import { readPage, readStaffAccount, type OfficeStaff } from "@/office";
import { roleLabel, useSession } from "@/session";
import { useListPage } from "@/use-list-page";

export default function OfficeStaffList() {
  const { staffRequest } = useSession();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const qRef = useRef(q);
  const cacheRef = useRef(new Map<string, ListSnapshot<OfficeStaff>>());
  qRef.current = q;

  const list = useListPage<OfficeStaff>({
    idOf: (member) => member.id,
    loadPage: async (offset) => {
      const needle = qRef.current.trim();
      const search = needle ? `&q=${encodeURIComponent(needle)}` : "";
      const reply = await staffRequest(`/admin/staff?${pageQuery(offset)}${search}`);
      const page = reply.ok ? readPage(reply.data, readStaffAccount) : null;
      if (!page) {
        const error = replyError(reply) ?? "Staff didn't load";
        rememberFirstPage(cacheRef.current, needle, offset, { error });
        return { error };
      }
      const result = { items: page.items, total: page.total };
      rememberFirstPage(cacheRef.current, needle, offset, result);
      return result;
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    openCachedList(cacheRef.current, q.trim(), list);
  }, [q, list.clear, list.load, list.revise]);

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const rows = list.rows ?? [];

  return (
    <OfficeFrame title="Staff" refreshing={list.refreshing} onRefresh={list.refresh} onNearEnd={() => list.loadNext()}>
      <SearchField value={query} placeholder="Name, username, or title" onChange={setQuery} />
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        filling={list.filling}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        header={<HallButton label="Add staff" onPress={() => router.push("/staff/office/member")} />}
        empty={<EmptyState message="No staff yet" actionLabel="Add staff" onAction={() => router.push("/staff/office/member")} />}
      >
        <View>
          {rows.map((member, index, all) => (
            <DenseRow
              key={member.id}
              title={member.fullName}
              detail={`${member.username} · ${roleLabel(member.role)}`}
              time={member.status === "suspended" ? "Suspended" : member.jobTitle}
              late={member.status === "suspended"}
              first={index === 0}
              last={index === all.length - 1}
              onPress={() => router.push({ pathname: "/staff/office/member", params: { id: member.id } })}
            />
          ))}
        </View>
      </PagedList>
    </OfficeFrame>
  );
}
