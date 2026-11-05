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
import { readPage, readResident, type OfficeResident } from "@/office";
import { useSession } from "@/session";
import { useDebouncedValue } from "@/use-debounced-value";
import { useFilteredPagedList } from "@/use-filtered-paged-list";

export default function OfficeResidents() {
  const { staffRequest } = useSession();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const filters = useMemo(() => ({ q }), [q]);

  const list = useFilteredPagedList<OfficeResident, { q: string }>({
    idOf: (resident) => resident.id,
    filters,
    filterKey: q.trim(),
    cacheScope: "office-residents",
    refreshOnFocusWhenCached: true,
    loadPage: useCallback(
      async (current, offset) => {
        const search = new URLSearchParams(pageQuery(offset));
        const needle = current.q.trim().slice(0, 80);
        if (needle) {
          search.set("q", needle);
        }
        const reply = await staffRequest(`/admin/residents?${search.toString()}`);
        const page = reply.ok ? readPage(reply.data, readResident) : null;
        return page
          ? { items: page.items, total: page.total }
          : { error: replyError(reply) ?? "Residents didn't load" };
      },
      [staffRequest],
    ),
  });

  const rows = list.rows ?? [];
  const searching = query.trim().length > 0;

  return (
    <OfficeFrame title="Residents" refreshing={list.refreshing} onRefresh={list.refresh} onNearEnd={() => list.loadNext()}>
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        filling={list.filling}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        header={
          <>
            <SearchField value={query} placeholder="Name, enrolment, or room" onChange={setQuery} />
            <HallButton label="Add a resident" onPress={() => router.push("/staff/office/resident")} />
          </>
        }
        empty={
          <EmptyState
            message={searching ? "No one matches" : "No residents yet"}
            actionLabel={searching ? undefined : "Add a resident"}
            onAction={searching ? undefined : () => router.push("/staff/office/resident")}
          />
        }
      >
        <View>
          {rows.map((resident, index, all) => (
            <DenseRow
              key={resident.id}
              title={resident.fullName}
              detail={`${resident.enrolmentNumber} · ${resident.roomLabel}`}
              time={resident.status === "suspended" ? "Suspended" : resident.presence === "outside" ? "Outside" : "Inside"}
              late={resident.status === "suspended"}
              first={index === 0}
              last={index === all.length - 1}
              onPress={() => router.push({ pathname: "/staff/office/resident", params: { id: resident.id } })}
            />
          ))}
        </View>
      </PagedList>
    </OfficeFrame>
  );
}
