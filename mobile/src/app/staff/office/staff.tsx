import { useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState } from "@/components/list-state";
import { OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { pageQuery } from "@/list-page";
import { readPage, readStaffAccount, type OfficeStaff } from "@/office";
import { roleLabel, useSession } from "@/session";
import { useListPage } from "@/use-list-page";

export default function OfficeStaffList() {
  const { staffRequest } = useSession();
  const list = useListPage<OfficeStaff>({
    idOf: (member) => member.id,
    loadPage: async (offset) => {
      const reply = await staffRequest(`/admin/staff?${pageQuery(offset)}`);
      const page = reply.ok ? readPage(reply.data, readStaffAccount) : null;
      return page ? { items: page.items, total: page.total } : { error: replyError(reply) ?? "Staff didn't load" };
    },
  });

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const rows = list.rows ?? [];

  return (
    <OfficeFrame title="Staff" refreshing={list.refreshing} onRefresh={list.refresh} onNearEnd={() => list.loadNext()}>
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
