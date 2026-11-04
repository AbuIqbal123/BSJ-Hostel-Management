import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState } from "@/components/list-state";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { SearchField } from "@/components/search-field";
import { pageQuery } from "@/list-page";
import { readPage, readStaffAccount, type OfficeStaff } from "@/office";
import { roleLabel, useSession } from "@/session";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";

export default function OfficeStaffList() {
  const { staffRequest } = useSession();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const filters = useMemo(() => ({ q }), [q]);

  const list = useFilteredPagedList<OfficeStaff, { q: string }>({
    idOf: (member) => member.id,
    filters,
    filterKey: q.trim(),
    loadPage: useCallback(async (current, offset) => {
      const needle = current.q.trim();
      const search = needle ? `&q=${encodeURIComponent(needle)}` : "";
      const reply = await staffRequest(`/admin/staff?${pageQuery(offset)}${search}`);
      const page = reply.ok ? readPage(reply.data, readStaffAccount) : null;
      if (!page) {
        return { error: replyError(reply) ?? "Staff didn't load" };
      }
      return { items: page.items, total: page.total };
    }, [staffRequest]),
  });

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
