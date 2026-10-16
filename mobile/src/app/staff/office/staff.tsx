import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { readPage, readStaffAccount, type OfficeStaff } from "@/office";
import { roleLabel, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PAGE = 50;

export default function OfficeStaffList() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [rows, setRows] = useState<OfficeStaff[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (offset: number) => {
      const search = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      void staffRequest(`/admin/staff?${search.toString()}`).then((reply) => {
        const page = reply.ok ? readPage(reply.data, readStaffAccount) : null;
        if (!page) {
          setError(replyError(reply) ?? "Staff didn't load");
          return;
        }
        setTotal(page.total);
        setRows((shown) => (offset === 0 ? page.items : [...(shown ?? []), ...page.items]));
        setError(null);
      });
    },
    [staffRequest],
  );

  useFocusEffect(
    useCallback(() => {
      load(0);
    }, [load]),
  );

  return (
    <OfficeFrame title="Staff">
      <HallButton label="Add staff" onPress={() => router.push("/staff/office/member")} />
      <OfficeError message={error} />
      <View>
        {(rows ?? []).map((member, index, all) => (
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
      {rows && rows.length === 0 ? <Text style={[text.body, { color: colors.inkSoft }]}>No staff yet</Text> : null}
      {rows && rows.length < total ? <HallButton label="More" onPress={() => load(rows.length)} /> : null}
    </OfficeFrame>
  );
}
