import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation } from "expo-router";
import { Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState, ListError } from "@/components/list-state";
import { PagedList } from "@/components/paged-list";
import { pageQuery } from "@/list-page";
import { useListPage } from "@/use-list-page";
import { formatHallDate } from "@/format-when";
import {
  arrivalRefusal,
  departureRefusal,
  gateGuestLine,
  readGateGuests,
  readGateMessage,
  readOccupancy,
  type GateGuest,
  type GateOccupancy,
} from "@/gate-guests";
import { useSession } from "@/session";
import { shortDay, trimStop } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type Bucket = "expected" | "in_hall";

function dates(guest: GateGuest): string {
  return `${shortDay(formatHallDate(guest.start))} to ${shortDay(formatHallDate(guest.end))}`;
}

export default function GateGuestsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { staffRequest } = useSession();
  const [bucket, setBucket] = useState<Bucket>("expected");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [occupancy, setOccupancy] = useState<GateOccupancy | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<GateGuest | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bucketRef = useRef(bucket);
  const qRef = useRef(q);
  bucketRef.current = bucket;
  qRef.current = q;
  const list = useListPage<GateGuest>({
    idOf: (guest) => guest.id,
    loadPage: async (offset) => {
      const needle = qRef.current.trim().slice(0, 80);
      const search = needle ? `&q=${encodeURIComponent(needle)}` : "";
      const reply = await staffRequest(`/gate/guests?bucket=${bucketRef.current}&${pageQuery(offset)}${search}`);
      const page = reply.ok ? readGateGuests(reply.data) : null;
      return page
        ? { items: page.items, total: page.total }
        : { error: !reply.ok ? trimStop(reply.message) : "The guest list could not be read" };
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadOccupancy = useCallback(async () => {
    const reply = await staffRequest("/gate/occupancy");
    if (reply.ok) {
      setOccupancy(readOccupancy(reply.data));
    }
  }, [staffRequest]);

  useEffect(() => {
    list.clear();
    list.load();
    void loadOccupancy();
  }, [bucket, q, list.clear, list.load, loadOccupancy]);

  const record = async (guest: GateGuest) => {
    const arrival = bucket === "expected";
    setBusy(true);
    const reply = await staffRequest(
      `/gate/guests/${encodeURIComponent(guest.id)}/${arrival ? "arrival" : "departure"}`,
      undefined,
      "POST",
    );
    setBusy(false);
    if (!reply.ok) {
      const clear = arrival ? arrivalRefusal(reply.code, guest.bucket) : departureRefusal(reply.code);
      setSheetError(clear ?? trimStop(reply.message));
      return;
    }
    setOpen(null);
    setSheetError(null);
    setNotice(readGateMessage(reply.data) ?? (arrival ? "The guest is now in the hall." : "The guest has left."));
    list.load();
    void loadOccupancy();
  };

  const rows = list.rows ?? [];

  const counts =
    occupancy === null ? "" : `${occupancy.inHall} in the hall, ${occupancy.shouldHaveLeft} should have left`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 28 }]}>
      <View style={styles.pad}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBackOr(navigation, "/staff")}
          style={styles.back}
        >
          <BackMark color={colors.inkSoft} />
        </Pressable>
        <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Guests</Text>
        {counts ? <Text style={[text.body, { color: colors.inkSoft }]}>{counts}</Text> : null}
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.ink }]}>
            {notice}
          </Text>
        ) : null}
        <View style={[styles.segment, { backgroundColor: colors.line }]}>
          {(
            [
              ["expected", "Expected"],
              ["in_hall", "In the hall"],
            ] as const
          ).map(([value, label]) => {
            const on = bucket === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setBucket(value)}
                style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
              >
                <Text style={[text.label, { color: on ? colors.ink : colors.inkSoft }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Guest, host, or room"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[text.field, styles.search, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.ink }]}
        />
        {list.error && rows.length > 0 ? <ListError message={list.error} onRetry={list.refresh} /> : null}
      </View>
      <PagedList
        kind="flat"
        style={styles.list}
        rows={list.rows}
        data={rows}
        error={rows.length > 0 ? null : list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, paddingHorizontal: 28, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.inkFaint} />}
        onEndReached={() => list.loadNext()}
        empty={
          <EmptyState
            message={q.trim() ? `Nothing matches ${q.trim()}` : bucket === "expected" ? "No one is expected" : "No guests in the hall"}
          />
        }
        renderItem={({ item, index }) => (
          <DenseRow
            title={item.guestName}
            detail={`${item.hostRoom} · ${item.hostName} · ${dates(item)}`}
            time={gateGuestLine(item)}
            first={index === 0}
            last={index === rows.length - 1}
            onPress={() => {
              setSheetError(null);
              setOpen(item);
            }}
          />
        )}
      />
      {open ? (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(null)}>
          <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={() => setOpen(null)} />
          <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + 20 }]}>
            <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{open.guestName}</Text>
            <Text style={[text.body, { color: colors.inkSoft }]}>{`${open.hostName}, ${open.hostRoom}`}</Text>
            <Text style={[text.body, { color: colors.ink }]}>{`${dates(open)} · ${gateGuestLine(open)}`}</Text>
            {sheetError ? (
              <Text accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>
                {sheetError}
              </Text>
            ) : null}
            <HallButton
              label={bucket === "expected" ? "Record arrival" : "Record departure"}
              busy={busy}
              onPress={() => void record(open)}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
  pad: { paddingHorizontal: 28, gap: 16, paddingBottom: 8 },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginLeft: -6 },
  title: { textAlign: "left" },
  segment: { flexDirection: "row", borderRadius: 10, borderCurve: "continuous", padding: 2 },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  search: { height: 48, borderWidth: 1, borderRadius: 12, borderCurve: "continuous", paddingHorizontal: 14 },
  empty: { textAlign: "center", paddingTop: 96 },
  scrim: { flex: 1, backgroundColor: "rgba(20, 38, 31, 0.32)" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: "continuous",
    paddingHorizontal: 28,
    paddingTop: 22,
    gap: 14,
  },
});
