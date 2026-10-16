import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { SkeletonRows } from "@/components/skeleton";
import { formatWhenParts } from "@/format-when";
import { acceptFailure, acceptPage, shouldRequestNext, type Listed } from "@/list-page";
import { readAudit, readPage, type AuditRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PAGE = 50;

export default function OfficeAudit() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const paging = useRef(false);
  const [list, setList] = useState<Listed<AuditRow>>({ rows: null, total: 0, error: null, pageError: null });
  const [pagingUi, setPagingUi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

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
      void staffRequest(`/admin/audit?limit=${PAGE}&offset=${offset}`).then((reply) => {
        if (offset > 0) {
          paging.current = false;
          setPagingUi(false);
        }
        if (fromPull) {
          setRefreshing(false);
        }
        const page = reply.ok ? readPage(reply.data, readAudit) : null;
        const message = replyError(reply) ?? "The audit log didn't load";
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
  const selected = rows.find((row) => row.id === open) ?? null;

  return (
    <OfficeFrame
      title="Audit"
      refreshing={refreshing}
      onRefresh={() => load(0, true)}
      onNearEnd={() => {
        if (shouldRequestNext(rows.length, list.total, paging.current, list.pageError !== null)) {
          load(rows.length);
        }
      }}
    >
      {list.rows === null && !list.error ? <SkeletonRows count={4} kind="row" /> : null}
      {list.error && rows.length === 0 ? <ListError message={list.error} onRetry={() => load(0)} /> : null}
      {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={() => load(0, true)} /> : null}
      {selected ? (
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
      {list.rows && rows.length === 0 && !list.error ? <EmptyState message="Nothing recorded yet" /> : null}
      {pagingUi ? <SkeletonRows count={1} kind="row" /> : null}
      {list.pageError ? <RetryRow message={list.pageError} onRetry={() => load(rows.length)} /> : null}
    </OfficeFrame>
  );
}
