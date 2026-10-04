import { useCallback, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhenParts } from "@/format-when";
import { useSession, type HallPermission, type PermissionKind, type PermissionStatus } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

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
  const { loadPermissions } = useSession();
  const [items, setItems] = useState<HallPermission[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loadPermissionsRef = useRef(loadPermissions);
  loadPermissionsRef.current = loadPermissions;

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
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const openForm = (kind: PermissionKind) => {
    router.push({ pathname: "/permission", params: { kind } });
  };

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
      {failed ? (
        <Text style={[text.error, { color: colors.danger }]}>Permissions didn't load.</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View style={[styles.requests, { borderTopColor: colors.line }]}>
          <Text style={[text.button, { color: colors.ink }]}>Your requests</Text>
          <View style={styles.list}>
            {soonestFirst(items).map((item) => (
              <PermissionRow key={item.id} item={item} />
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
