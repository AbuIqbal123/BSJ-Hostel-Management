import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { formatWhenParts } from "@/format-when";
import { pageQuery } from "@/list-page";
import { readAudit, readPage, type AuditRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { useListPage } from "@/use-list-page";

export default function OfficeAudit() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const list = useListPage<AuditRow>({
    idOf: (row) => row.id,
    loadPage: async (offset) => {
      const reply = await staffRequest(`/admin/audit?${pageQuery(offset)}`);
      const page = reply.ok ? readPage(reply.data, readAudit) : null;
      return page
        ? { items: page.items, total: page.total }
        : { error: replyError(reply) ?? "The audit log didn't load" };
    },
  });

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const rows = list.rows ?? [];
  const selected = rows.find((row) => row.id === open) ?? null;

  return (
    <OfficeFrame title="Audit" refreshing={list.refreshing} onRefresh={list.refresh} onNearEnd={() => list.loadNext()}>
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        filling={list.filling}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        empty="Nothing recorded yet"
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
