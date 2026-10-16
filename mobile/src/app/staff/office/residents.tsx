import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { SearchField } from "@/components/search-field";
import { SkeletonRows } from "@/components/skeleton";
import { acceptFailure, acceptPage, shouldRequestNext, type Listed } from "@/list-page";
import { readPage, readResident, type OfficeResident } from "@/office";
import { useSession } from "@/session";

const PAGE = 50;
const EMPTY: Listed<OfficeResident> = { rows: null, total: 0, error: null, pageError: null };

export default function OfficeResidents() {
  const { staffRequest } = useSession();
  const ticket = useRef(0);
  const paging = useRef(false);
  const [query, setQuery] = useState("");
  const seenQuery = useRef(query);
  const [list, setList] = useState<Listed<OfficeResident>>(EMPTY);
  const [pagingUi, setPagingUi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (q: string, offset: number, fromPull = false) => {
      if (offset > 0) {
        if (paging.current) {
          return;
        }
        paging.current = true;
        setPagingUi(true);
      }
      if (fromPull) {
        setRefreshing(true);
      }
      const search = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      const needle = q.trim().slice(0, 80);
      if (needle) {
        search.set("q", needle);
      }
      const current = offset === 0 ? ++ticket.current : ticket.current;
      void staffRequest(`/admin/residents?${search.toString()}`).then((reply) => {
        if (offset > 0) {
          paging.current = false;
          setPagingUi(false);
        }
        if (fromPull) {
          setRefreshing(false);
        }
        if (current !== ticket.current) {
          return;
        }
        const page = reply.ok ? readPage(reply.data, readResident) : null;
        const message = replyError(reply) ?? "Residents didn't load";
        setList((state) =>
          page ? acceptPage(state, offset, page.items, page.total, (item) => item.id) : acceptFailure(state, offset, message),
        );
      });
    },
    [staffRequest],
  );

  useFocusEffect(
    useCallback(() => {
      if (seenQuery.current !== query) {
        seenQuery.current = query;
        ticket.current += 1;
        paging.current = false;
        setList(EMPTY);
      }
      const timer = setTimeout(() => load(query, 0), query ? 300 : 0);
      return () => clearTimeout(timer);
    }, [load, query]),
  );

  const rows = list.rows ?? [];
  const near = () => {
    if (!shouldRequestNext(rows.length, list.total, paging.current, list.pageError !== null)) {
      return;
    }
    load(query, rows.length);
  };

  return (
    <OfficeFrame
      title="Residents"
      refreshing={refreshing}
      onRefresh={() => load(query, 0, true)}
      onNearEnd={near}
    >
      <SearchField value={query} placeholder="Name, enrolment, or room" onChange={setQuery} />
      <HallButton label="Add a resident" onPress={() => router.push("/staff/office/resident")} />
      {list.rows === null && !list.error ? <SkeletonRows count={4} kind="row" /> : null}
      {list.error && rows.length === 0 ? <ListError message={list.error} onRetry={() => load(query, 0)} /> : null}
      {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={() => load(query, 0, true)} /> : null}
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
      {list.rows && rows.length === 0 && !list.error ? (
        <EmptyState
          message={query.trim() ? "No one matches" : "No residents yet"}
          actionLabel={query.trim() ? undefined : "Add a resident"}
          onAction={query.trim() ? undefined : () => router.push("/staff/office/resident")}
        />
      ) : null}
      {pagingUi ? <SkeletonRows count={1} kind="row" /> : null}
      {list.pageError ? <RetryRow message={list.pageError} onRetry={() => load(query, rows.length)} /> : null}
    </OfficeFrame>
  );
}
