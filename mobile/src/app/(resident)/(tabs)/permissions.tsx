import { useCallback, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, ListError, RetryRow } from "@/components/list-state";
import { SkeletonRows } from "@/components/skeleton";
import { PagedList } from "@/components/paged-list";
import { PlainRow, RowHairline } from "@/components/plain-row";
import { SectionHead } from "@/components/section-head";
import { useListPage } from "@/use-list-page";
import { formatHallDate, formatWhenParts } from "@/format-when";
import { olderAvailable } from "@/list-page";
import { guestLine, statusSentence } from "@/requests";
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

function GuestStayRow({ item, first }: { item: GuestStayCard; first: boolean }) {
  const status = guestLine(item);
  const dates = `${formatHallDate(item.startDate)} to ${formatHallDate(item.endDate)}`;
  return (
    <View>
      {first ? null : <RowHairline />}
      <PlainRow
        title={item.guestName}
        aside={status}
        parts={[dates]}
        onPress={() => router.push({ pathname: "/guest", params: { id: item.id } })}
        label={`${item.guestName}. ${status}. ${dates}`}
      />
    </View>
  );
}

function PermissionRow({ item, first }: { item: HallPermission; first: boolean }) {
  const status = statusSentence(item.status);
  const home = item.permissionType === "home_going";
  const when = home ? null : permissionWhen(item.departureAt, item.expectedReturnAt);
  const dates = home ? homeDates(item.departureAt, item.expectedReturnAt) : "";
  return (
    <View>
      {first ? null : <RowHairline />}
      <PlainRow
        title={item.shortPlace}
        aside={status}
        parts={home ? [dates] : [when?.day ?? ""]}
        extra={home ? null : when?.span}
        onPress={() => router.push({ pathname: "/permission", params: { id: item.id } })}
        label={
          home
            ? `${item.shortPlace}. ${status}. ${dates}`
            : `${item.shortPlace}. ${status}. ${when?.day}. ${when?.span}`
        }
      />
    </View>
  );
}

export default function PermissionsScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadPermissions, loadGuestStays } = useSession();
  const [tab, setTab] = useState<RequestTab>("late_night");
  const measured = useRef({ content: 0, view: 0 });
  const permissions = useListPage<HallPermission>({
    idOf: (item) => item.id,
    loadPage: async (offset) => {
      const result = await loadPermissions(offset);
      return result.error !== null ? { error: result.error } : { items: result.items, total: result.total };
    },
  });
  const stays = useListPage<GuestStayCard>({
    auto: false,
    idOf: (item) => item.id,
    loadPage: async () => {
      const result = await loadGuestStays("upcoming", 0);
      return result.error !== null ? { error: result.error } : { items: result.items, total: result.total };
    },
  });
  const older = useListPage<GuestStayCard>({
    auto: false,
    idOf: (item) => item.id,
    loadPage: async (offset) => {
      const result = await loadGuestStays("past", offset);
      return result.error !== null ? { error: result.error } : { items: result.items, total: result.total };
    },
  });

  const load = useCallback(() => {
    permissions.load();
    stays.load();
  }, [permissions.load, stays.load]);
  const refresh = useCallback(() => {
    permissions.refresh();
    stays.refresh();
    if (older.rows !== null) {
      older.refresh();
    }
  }, [older.refresh, older.rows, permissions.refresh, stays.refresh]);
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
  const shown = tab === "guest" ? shownStays : shownPermissions;
  const visible = active.rows === null ? null : shown;
  const refreshing = permissions.refreshing || stays.refreshing || older.refreshing;
  const emptyCopy =
    tab === "guest" ? "No upcoming guests" : tab === "home_going" ? "No home-going requests" : "No late-night requests";
  const emptyAction = tab === "guest" ? "Request guest stay" : tab === "home_going" ? "Request home going" : "Request late-night";

  // Older stays load only when she asks, so the tab opens on what is still ahead.
  const showOlder = () => {
    older.loadNext(true);
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
      onLayout={(event) => {
        measured.current.view = event.nativeEvent.layout.height;
        permissions.noteSize(measured.current.content, measured.current.view);
      }}
      onContentSizeChange={(_width, height) => {
        measured.current.content = height;
        permissions.noteSize(measured.current.content, measured.current.view);
      }}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        if (tab !== "guest" && contentSize.height - (contentOffset.y + layoutMeasurement.height) < 280) {
          permissions.loadNext();
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
          <Text numberOfLines={1} style={[styles.rowLabel, { color: colors.ink }]}>
            Request late-night
          </Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        <RowHairline />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request home going"
          onPress={() => openForm("home_going")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={[styles.rowLabel, { color: colors.ink }]}>
            Request home going
          </Text>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        <RowHairline />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request guest stay"
          onPress={() => router.push("/guest")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={[styles.rowLabel, { color: colors.ink }]}>
            Request guest stay
          </Text>
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
      <PagedList
        rows={visible}
        error={active.error}
        pageError={tab === "guest" ? null : permissions.pageError}
        showListSkeleton={active.showListSkeleton}
        showPageSkeleton={tab !== "guest" && permissions.showPageSkeleton}
        filling={tab !== "guest" && permissions.filling}
        onRetry={visible !== null && visible.length > 0 ? refresh : load}
        onRetryPage={() => permissions.loadNext(true)}
        skeletonCount={3}
        skeletonKind="card"
        empty={
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
        }
        footer={
          tab === "guest" ? (
            <>
              {olderRows.length > 0 ? (
                <View style={styles.requests}>
                  <SectionHead title="Older" padTop={24} />
                  <View>
                    {olderRows.map((item, index) => (
                      <GuestStayRow key={item.id} item={item} first={index === 0} />
                    ))}
                  </View>
                </View>
              ) : null}
              {stays.rows !== null && older.error !== null && older.rows === null ? (
                <ListError message="Older guest stays didn't load" onRetry={showOlder} />
              ) : null}
              {older.rows !== null && older.error !== null ? (
                <ListError message={older.error} onRetry={showOlder} />
              ) : null}
              {older.showPageSkeleton ? <SkeletonRows count={1} kind="card" /> : null}
              {older.pageError ? <RetryRow message={older.pageError} onRetry={showOlder} /> : null}
              {stays.rows !== null &&
              !older.showPageSkeleton &&
              olderAvailable({
                rows: older.rows,
                total: older.total,
                error: older.error,
                pageError: older.pageError,
              }) ? (
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
            </>
          ) : null
        }
      >
        {shown.length > 0 ? (
          <View style={styles.requests}>
            <SectionHead title="Your requests" padTop={0} />
            <View>
              {shownPermissions.map((item, index) => (
                <PermissionRow key={item.id} item={item} first={index === 0} />
              ))}
              {shownStays.map((item, index) => (
                <GuestStayRow key={item.id} item={item} first={index === 0} />
              ))}
            </View>
          </View>
        ) : null}
      </PagedList>
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
  rows: {},
  tabs: { flexDirection: "row", gap: 16 },
  tab: { flex: 1, minHeight: 44, justifyContent: "flex-end", gap: 8 },
  tabLabel: { textAlign: "center" },
  tabMark: { height: 2, borderRadius: 1 },
  row: {
    minHeight: 48,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: { flex: 1, fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  requests: { marginTop: -4 },
  pressed: { opacity: 0.6 },
  older: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
});
