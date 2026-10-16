import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { SearchField } from "@/components/search-field";
import { readPage, readResident, type OfficeResident } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PAGE = 50;

export default function OfficeResidents() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const ticket = useRef(0);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<OfficeResident[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (q: string, offset: number) => {
      const search = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      const needle = q.trim().slice(0, 80);
      if (needle) {
        search.set("q", needle);
      }
      const current = offset === 0 ? ++ticket.current : ticket.current;
      void staffRequest(`/admin/residents?${search.toString()}`).then((reply) => {
        if (current !== ticket.current) {
          return;
        }
        const page = reply.ok ? readPage(reply.data, readResident) : null;
        if (!page) {
          setError(replyError(reply) ?? "Residents didn't load");
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
      const timer = setTimeout(() => load(query, 0), query ? 300 : 0);
      return () => clearTimeout(timer);
    }, [load, query]),
  );

  return (
    <OfficeFrame title="Residents">
      <SearchField value={query} placeholder="Name, enrolment, or room" onChange={setQuery} />
      <HallButton label="Add a resident" onPress={() => router.push("/staff/office/resident")} />
      <OfficeError message={error} />
      <View>
        {(rows ?? []).map((resident, index, all) => (
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
      {rows && rows.length === 0 ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>{query.trim() ? "No one matches" : "No residents yet"}</Text>
      ) : null}
      {rows && rows.length < total ? (
        <HallButton label="More" onPress={() => load(query, rows.length)} />
      ) : null}
    </OfficeFrame>
  );
}
