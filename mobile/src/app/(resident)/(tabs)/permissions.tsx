import { useCallback, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { SkeletonRows } from "@/components/skeleton";
import { formatHallDate, formatWhenParts } from "@/format-when";
import { acceptFailure, acceptPage, olderAvailable, shouldRequestNext, type Listed } from "@/list-page";
import { guestLine, kindLabel, statusSentence, statusTone } from "@/requests";
import { useSession, type GuestStayCard, type HallPermission, type PermissionKind } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type RequestTab = "late_night" | "home_going" | "guest";

const REQUEST_TABS: { id: RequestTab; label: string }[] = [
  { id: "late_night", label: "Late-night" },
  { id: "home_going", label: "Home going" },
  { id: "guest", label: "Guest stays" },
];

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
  const [permissions, setPermissions] = useState<Listed<HallPermission>>({
    rows: null,
    total: 0,
    error: null,
    pageError: null,
  });
  const [stays, setStays] = useState<Listed<GuestStayCard>>({ rows: null, total: 0, error: null, pageError: null });
  const [older, setOlder] = useState<Listed<GuestStayCard>>({ rows: null, total: 0, error: null, pageError: null });
  const [olderBusy, setOlderBusy] = useState(false);
  const olderRef = useRef(false);
  const [tab, setTab] = useState<RequestTab>("late_night");
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const pagingRef = useRef(false);
  const loadPermissionsRef = useRef(loadPermissions);
  const loadGuestStaysRef = useRef(loadGuestStays);
  loadPermissionsRef.current = loadPermissions;
  loadGuestStaysRef.current = loadGuestStays;
  const olderLoadedRef = useRef(false);
  olderLoadedRef.current = older.rows !== null;

  const load = useCallback(() => {
    let active = true;
    void loadPermissionsRef.current(0).then((result) => {
      if (!active) {
        return;
      }
      setPermissions((state) =>
        result.error !== null
          ? acceptFailure(state, 0, result.error)
          : acceptPage(state, 0, result.items, result.total, (item) => item.id),
      );
    });
    void loadGuestStaysRef.current("upcoming", 0).then((result) => {
      if (!active) {
        return;
      }
      setStays((state) =>
        result.error !== null
          ? acceptFailure(state, 0, result.error)
          : acceptPage(state, 0, result.items, result.total, (item) => item.id),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        setRefreshing(false);
      }
    };
    if (olderLoadedRef.current) {
      pending += 1;
      void loadGuestStaysRef.current("past", 0).then((result) => {
        setOlder((state) =>
          result.error !== null
            ? acceptFailure(state, 0, result.error)
            : acceptPage(state, 0, result.items, result.total, (item) => item.id),
        );
        done();
      });
    }
    void loadPermissionsRef.current(0).then((result) => {
      setPermissions((state) =>
        result.error !== null
          ? acceptFailure(state, 0, result.error)
          : acceptPage(state, 0, result.items, result.total, (item) => item.id),
      );
      done();
    });
    void loadGuestStaysRef.current("upcoming", 0).then((result) => {
      setStays((state) =>
        result.error !== null
          ? acceptFailure(state, 0, result.error)
          : acceptPage(state, 0, result.items, result.total, (item) => item.id),
      );
      done();
    });
  }, []);

  useFocusEffect(load);

  const openForm = (kind: PermissionKind) => {
    router.push({ pathname: "/permission", params: { kind } });
  };
  const permissionRows = permissions.rows ?? [];
  const stayRows = stays.rows ?? [];
  const shownPermissions =
    tab === "guest" ? [] : soonestFirst(permissionRows.filter((item) => item.permissionType === tab));
  const shownStays = tab !== "guest" ? [] : stayRows;
  const olderRows = tab === "guest" ? (older.rows ?? []) : [];
  const active = tab === "guest" ? stays : permissions;
  const loadedCount = tab === "guest" ? stayRows.length : permissionRows.length;
  const waiting = active.rows === null && active.error === null;
  const firstFailure = active.error !== null && loadedCount === 0;
  const emptyCopy =
    tab === "guest" ? "No upcoming guests" : tab === "home_going" ? "No home-going requests" : "No late-night requests";
  const emptyAction = tab === "guest" ? "Request guest stay" : tab === "home_going" ? "Request home going" : "Request late-night";

  const more = (force = false) => {
    if (pagingRef.current || tab === "guest") {
      return;
    }
    const offset = loadedCount;
    if (!force && !shouldRequestNext(offset, permissions.total, false, permissions.pageError !== null)) {
      return;
    }
    if (force && offset >= permissions.total) {
      return;
    }
    pagingRef.current = true;
    setPaging(true);
    void loadPermissionsRef.current(offset).then((result) => {
      pagingRef.current = false;
      setPaging(false);
      setPermissions((state) =>
        result.error !== null
          ? acceptFailure(state, offset, result.error)
          : acceptPage(state, offset, result.items, result.total, (item) => item.id),
      );
    });
  };

  // Older stays load only when she asks, so the tab opens on what is still ahead.
  const showOlder = () => {
    if (olderRef.current) {
      return;
    }
    const offset = older.rows?.length ?? 0;
    olderRef.current = true;
    setOlderBusy(true);
    void loadGuestStaysRef.current("past", offset).then((result) => {
      olderRef.current = false;
      setOlderBusy(false);
      setOlder((state) =>
        result.error !== null
          ? acceptFailure(state, offset, result.error)
          : acceptPage(state, offset, result.items, result.total, (item) => item.id),
      );
    });
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.inkFaint} />}
      scrollEventThrottle={200}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        if (tab !== "guest" && contentSize.height - (contentOffset.y + layoutMeasurement.height) < 280) {
          more();
        }
      }}
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
      {waiting ? <SkeletonRows count={3} kind="card" /> : null}
      {firstFailure ? (
        <ListError message={active.error ?? "This list didn't load"} onRetry={load} />
      ) : null}
      {active.error && loadedCount > 0 ? <ListError message={active.error} onRetry={refresh} /> : null}
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
      {!waiting && !firstFailure && shownPermissions.length === 0 && shownStays.length === 0 && (tab === "guest" || !shouldRequestNext(loadedCount, active.total, paging, active.pageError !== null)) ? (
        <EmptyState
          message={emptyCopy}
          actionLabel={emptyAction}
          onAction={() => {
            if (tab === "guest") {
              router.push("/guest");
              return;
            }
            openForm(tab);
          }}
        />
      ) : null}
      {tab === "guest" && olderRows.length > 0 ? (
        <View style={[styles.requests, { borderTopColor: colors.line }]}>
          <Text style={[text.button, { color: colors.ink }]}>Older</Text>
          <View style={styles.list}>
            {olderRows.map((item) => (
              <GuestStayRow key={item.id} item={item} />
            ))}
          </View>
        </View>
      ) : null}
      {tab === "guest" && stays.rows !== null && older.error !== null && older.rows === null ? (
        <ListError message="Older guest stays didn't load" onRetry={showOlder} />
      ) : null}
      {tab === "guest" && older.rows !== null && older.error !== null ? (
        <ListError message={older.error} onRetry={showOlder} />
      ) : null}
      {tab === "guest" && olderBusy ? <SkeletonRows count={1} kind="card" /> : null}
      {tab === "guest" && older.pageError ? <RetryRow message={older.pageError} onRetry={showOlder} /> : null}
      {tab === "guest" && stays.rows !== null && !olderBusy && olderAvailable(older) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show older"
          onPress={showOlder}
          hitSlop={12}
          style={styles.older}
        >
          <Text style={[text.button, { color: colors.forest }]}>Show older</Text>
        </Pressable>
      ) : null}
      {tab !== "guest" && paging ? <SkeletonRows count={1} kind="card" /> : null}
      {tab !== "guest" && permissions.pageError ? (
        <RetryRow message={permissions.pageError} onRetry={() => more(true)} />
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
  older: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
});
