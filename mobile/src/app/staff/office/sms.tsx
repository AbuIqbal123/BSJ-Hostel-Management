import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { formatWhenParts } from "@/format-when";
import { noticeLabel, readPage, readSms, type SmsRow } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PAGE = 50;

export default function OfficeSms() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [rows, setRows] = useState<SmsRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (offset: number) => {
      void staffRequest(`/admin/sms?limit=${PAGE}&offset=${offset}`).then((reply) => {
        const page = reply.ok ? readPage(reply.data, readSms) : null;
        if (!page) {
          setError(replyError(reply) ?? "Texts didn't load");
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

  const selected = rows?.find((row) => row.id === open) ?? null;

  return (
    <OfficeFrame title="Text messages">
      <OfficeError message={error} />
      {selected ? (
        <View style={{ gap: 8 }}>
          <Text selectable style={[text.body, { color: colors.ink }]}>
            {selected.body}
          </Text>
          <Text style={[text.error, { color: colors.inkSoft }]}>{selected.phone}</Text>
        </View>
      ) : null}
      <View>
        {(rows ?? []).map((row, index, all) => {
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
      {rows && rows.length === 0 ? <Text style={[text.body, { color: colors.inkSoft }]}>No texts yet</Text> : null}
      {rows && rows.length < total ? <HallButton label="More" onPress={() => load(rows.length)} /> : null}
    </OfficeFrame>
  );
}
