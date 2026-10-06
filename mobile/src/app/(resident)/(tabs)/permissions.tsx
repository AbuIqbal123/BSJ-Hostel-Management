import { useCallback, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatHallDate, formatWhenParts } from "@/format-when";
import { useSession, type GuestStayCard, type HallPermission, type PermissionKind, type PermissionStatus } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type RequestTab = "late_night" | "home_going" | "guest";

const REQUEST_TABS: { id: RequestTab; label: string }[] = [
  { id: "late_night", label: "Late-night" },
  { id: "home_going", label: "Home going" },
  { id: "guest", label: "Guest stays" },
];

export function guestLine(item: GuestStayCard): string {
  if (item.bucket === "in_hall") {
    return "In the hall";
  }
  if (item.bucket === "should_have_left") {
    return "Should have left";
  }
  if (item.status === "approved" && item.paymentStatus === "unpaid") {
    return "Approved, not yet paid";
  }
  if (item.status === "pending") {
    return "Pending";
  }
  if (item.status === "approved") {
    return "Approved";
  }
  if (item.status === "rejected") {
    return "Rejected";
  }
  if (item.status === "cancelled") {
    return "Cancelled";
  }
  return "Departed";
}

function kindLabel(kind: PermissionKind): string {
  return kind === "late_night" ? "Late-night" : "Home going";
}

function statusSentence(status: PermissionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "in_use":
      return "Out";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
  }
}

function permissionWhen(departureAt: string, expectedReturnAt: string): { day: string; span: string } {
  const leave = formatWhenParts(departureAt);
  const back = formatWhenParts(expectedReturnAt);
  if (!leave || !back) {
    return { day: departureAt, span: expectedReturnAt };
  }
  if (leave.day === back.day) {
    return { day: leave.day, span: `${leave.clock} to ${back.clock}` };
  }
  return { day: leave.day, span: `${leave.clock} to ${back.clock}, ${back.day}` };
}

function homeDates(departureAt: string, expectedReturnAt: string): string {
  const leave = formatWhenParts(departureAt);
  const back = formatWhenParts(expectedReturnAt);
  if (!leave || !back) {
    return departureAt;
  }
  if (leave.day === back.day) {
    return leave.day;
  }
  return `${leave.day} to ${back.day}`;
}

function soonestFirst(items: HallPermission[]): HallPermission[] {
  return [...items].sort((left, right) => {
    if (left.departureAt < right.departureAt) {
      return -1;
    }
    if (left.departureAt > right.departureAt) {
      return 1;
    }
    if (left.createdAt < right.createdAt) {
      return -1;
    }
    if (left.createdAt > right.createdAt) {
      return 1;
    }
    return 0;
  });
}

function statusTone(status: PermissionStatus, colors: ReturnType<typeof useHallColors>) {
  if (status === "approved" || status === "in_use") {
    return { color: colors.forest, border: colors.forest, background: colors.approvedBg };
  }
  if (status === "rejected") {
    return { color: colors.danger, border: colors.danger, background: colors.dangerBg };
  }
  if (status === "pending") {
    return { color: colors.pending, border: colors.pending, background: colors.pendingBg };
  }
  return { color: colors.inkSoft, border: colors.line, background: colors.surface };
}

function guestTone(item: GuestStayCard, colors: ReturnType<typeof useHallColors>) {
  if (item.status === "rejected") {
    return { color: colors.danger, border: colors.danger, background: colors.dangerBg };
  }
  if (item.status === "pending") {
    return { color: colors.pending, border: colors.pending, background: colors.pendingBg };
  }
  if (item.status === "approved" || item.bucket === "in_hall") {
    return { color: colors.forest, border: colors.forest, background: colors.approvedBg };
  }
  return { color: colors.inkSoft, border: colors.line, background: colors.surface };
}

function GuestStayRow({ item }: { item: GuestStayCard }) {
  const colors = useHallColors();
  const tone = guestTone(item, colors);
  const status = guestLine(item);
  const dates = `${formatHallDate(item.startDate)} to ${formatHallDate(item.endDate)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.guestName}. ${status}. ${dates}`}
      onPress={() => router.push({ pathname: "/guest", params: { id: item.id } })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.place, { color: colors.ink }]}>{item.guestName}</Text>
        <View style={[styles.status, { borderColor: tone.border, backgroundColor: tone.background }]}>
          <Text style={[styles.statusText, { color: tone.color }]}>{status}</Text>
        </View>
      </View>
      <Text style={[text.body, { color: colors.ink }]}>{dates}</Text>
    </Pressable>
  );
}

function PermissionRow({ item }: { item: HallPermission }) {
  const colors = useHallColors();
  const kind = kindLabel(item.permissionType);
  const status = statusSentence(item.status);
  const home = item.permissionType === "home_going";
  const when = home ? null : permissionWhen(item.departureAt, item.expectedReturnAt);
  const dates = home ? homeDates(item.departureAt, item.expectedReturnAt) : "";
  const tone = statusTone(item.status, colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        home
          ? `${item.shortPlace}. ${kind}. ${status}. ${dates}`
          : `${item.shortPlace}. ${kind}. ${status}. ${when?.day}. ${when?.span}`
      }
      onPress={() => {
        router.push({ pathname: "/permission", params: { id: item.id } });
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.place, { color: colors.ink }]}>{item.shortPlace}</Text>
        <View style={[styles.status, { borderColor: tone.border, backgroundColor: tone.background }]}>
          <Text style={[styles.statusText, { color: tone.color }]}>{status}</Text>
        </View>
      </View>
      <Text style={[text.body, { color: colors.inkSoft }]}>{kind}</Text>
      {home ? (
        <Text style={[text.body, { color: colors.ink }]}>{dates}</Text>
      ) : (
        <>
          <Text style={[text.body, { color: colors.inkSoft }]}>{when?.day}</Text>
          <Text style={[text.mono, { color: colors.ink }]}>{when?.span}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function PermissionsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadPermissions, loadGuestStays } = useSession();
  const [items, setItems] = useState<HallPermission[] | null>(null);
  const [stays, setStays] = useState<GuestStayCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [staysFailed, setStaysFailed] = useState(false);
  const [tab, setTab] = useState<RequestTab>("late_night");
  const loadPermissionsRef = useRef(loadPermissions);
  const loadGuestStaysRef = useRef(loadGuestStays);
  loadPermissionsRef.current = loadPermissions;
  loadGuestStaysRef.current = loadGuestStays;

  const load = useCallback(() => {
    let active = true;
    void loadPermissionsRef.current().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setItems(null);
        setFailed(true);
        return;
      }
      setFailed(false);
      setItems(result.items);
    });
    void loadGuestStaysRef.current().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setStays(null);
        setStaysFailed(true);
        return;
      }
      setStaysFailed(false);
      setStays(result.items);
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const openForm = (kind: PermissionKind) => {
    router.push({ pathname: "/permission", params: { kind } });
  };
  const shownPermissions =
    tab === "guest" || items === null
      ? []
      : soonestFirst(items.filter((item) => item.permissionType === tab));
  const shownStays =
    tab !== "guest" || stays === null
      ? []
      : [...stays].sort((left, right) => left.startDate.localeCompare(right.startDate));

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Permissions</Text>
      <View style={styles.rows}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request late-night"
          onPress={() => openForm("late_night")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Request late-night</Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request home going"
          onPress={() => openForm("home_going")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Request home going</Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request guest stay"
          onPress={() => router.push("/guest")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Request guest stay</Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
      </View>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {REQUEST_TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              onPress={() => setTab(item.id)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text style={[text.button, styles.tabLabel, { color: selected ? colors.forest : colors.inkSoft }]}>
                {item.label}
              </Text>
              <View style={[styles.tabMark, { backgroundColor: selected ? colors.forest : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>
      {tab !== "guest" && failed ? (
        <Text style={[text.error, { color: colors.danger }]}>Permissions didn't load</Text>
      ) : null}
      {tab === "guest" && staysFailed ? (
        <Text style={[text.error, { color: colors.danger }]}>Guest stays didn't load</Text>
      ) : null}
      {shownPermissions.length > 0 || shownStays.length > 0 ? (
        <View style={[styles.requests, { borderTopColor: colors.line }]}>
          <Text style={[text.button, { color: colors.ink }]}>Your requests</Text>
          <View style={styles.list}>
            {shownPermissions.map((item) => (
              <PermissionRow key={item.id} item={item} />
            ))}
            {shownStays.map((item) => (
              <GuestStayRow key={item.id} item={item} />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 28,
  },
  title: { textAlign: "left" },
  rows: { gap: 4 },
  tabs: { flexDirection: "row", gap: 16 },
  tab: { flex: 1, minHeight: 44, justifyContent: "flex-end", gap: 8 },
  tabLabel: { textAlign: "center" },
  tabMark: { height: 2, borderRadius: 1 },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requests: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 22,
    gap: 14,
  },
  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  place: {
    flex: 1,
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  status: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: { opacity: 0.6 },
});
