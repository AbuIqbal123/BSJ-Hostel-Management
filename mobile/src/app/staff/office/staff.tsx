import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { SkeletonRows } from "@/components/skeleton";
import { useDelayedLoading } from "@/use-delayed-loading";
import { acceptFailure, acceptPage, shouldRequestNext, type Listed } from "@/list-page";
import { readPage, readStaffAccount, type OfficeStaff } from "@/office";
import { roleLabel, useSession } from "@/session";

const PAGE = 50;

export default function OfficeStaffList() {
  const { staffRequest } = useSession();
  const paging = useRef(false);
  const [list, setList] = useState<Listed<OfficeStaff>>({ rows: null, total: 0, error: null, pageError: null });
  const [pagingUi, setPagingUi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (offset: number, fromPull = false) => {
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
      void staffRequest(`/admin/staff?${search.toString()}`).then((reply) => {
        if (offset > 0) {
          paging.current = false;
          setPagingUi(false);
        }
        if (fromPull) {
          setRefreshing(false);
        }
        const page = reply.ok ? readPage(reply.data, readStaffAccount) : null;
        const message = replyError(reply) ?? "Staff didn't load";
        setList((state) =>
          page ? acceptPage(state, offset, page.items, page.total, (item) => item.id) : acceptFailure(state, offset, message),
        );
      });
    },
    [staffRequest],
  );

  useFocusEffect(
    useCallback(() => {
      load(0);
    }, [load]),
  );

  const rows = list.rows ?? [];
  const showListSkeleton = useDelayedLoading((list.rows === null || refreshing) && list.error === null) && list.error === null;
  const showPageSkeleton = useDelayedLoading(pagingUi) && list.pageError === null;

  return (
    <OfficeFrame
      title="Staff"
      refreshing={refreshing}
      onRefresh={() => load(0, true)}
      onNearEnd={() => {
        if (shouldRequestNext(rows.length, list.total, paging.current, list.pageError !== null)) {
          load(rows.length);
        }
      }}
    >
      <HallButton label="Add staff" onPress={() => router.push("/staff/office/member")} />
      {showListSkeleton ? <SkeletonRows count={4} kind="row" /> : null}
      {list.error && rows.length === 0 ? <ListError message={list.error} onRetry={() => load(0)} /> : null}
      {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={() => load(0, true)} /> : null}
      <View>
        {(showListSkeleton ? [] : rows).map((member, index, all) => (
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
      {!showListSkeleton && list.rows && rows.length === 0 && !list.error ? (
        <EmptyState message="No staff yet" actionLabel="Add staff" onAction={() => router.push("/staff/office/member")} />
      ) : null}
      {showPageSkeleton ? <SkeletonRows count={1} kind="row" /> : null}
      {list.pageError ? <RetryRow message={list.pageError} onRetry={() => load(rows.length)} /> : null}
    </OfficeFrame>
  );
}
