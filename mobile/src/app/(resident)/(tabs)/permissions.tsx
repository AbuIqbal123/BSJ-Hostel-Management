import { useCallback, useRef, useState } from "react";
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
      return "You are out on this";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
  }
}

function permissionSpan(departureAt: string, expectedReturnAt: string): string {
  const leave = formatWhenParts(departureAt);
  const back = formatWhenParts(expectedReturnAt);
  if (!leave || !back) {
    return `${departureAt} to ${expectedReturnAt}`;
  }
  if (leave.day === back.day) {
    return `${leave.day}, ${leave.clock} to ${back.clock}`;
  }
  return `${leave.day}, ${leave.clock} to ${back.day}, ${back.clock}`;
}

function PermissionRow({ item }: { item: HallPermission }) {
  const colors = useHallColors();
  const kind = kindLabel(item.permissionType);
  const status = statusSentence(item.status);
  const span = permissionSpan(item.departureAt, item.expectedReturnAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.shortPlace}. ${kind}. ${status}. ${span}`}
      onPress={() => {
        router.push({ pathname: "/permission", params: { id: item.id } });
      }}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Text style={[styles.place, { color: colors.ink }]}>{item.shortPlace}</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{kind}</Text>
      <Text style={[text.body, { color: colors.ink }]}>{status}</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{span}</Text>
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
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request late-night"
          onPress={() => {
            openForm("late_night");
          }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.forest }]}>Request late-night</Text>
        </Pressable>
        <View style={[styles.hairline, { backgroundColor: colors.line }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request home going"
          onPress={() => {
            openForm("home_going");
          }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.forest }]}>Request home going</Text>
        </Pressable>
      </View>
      {failed ? (
        <Text style={[text.error, { color: colors.danger }]}>Permissions didn't load.</Text>
      ) : null}
      {items !== null && items.length === 0 ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>No permissions yet.</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={[styles.hairline, { backgroundColor: colors.line }]} /> : null}
              <PermissionRow item={item} />
            </View>
          ))}
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
  action: {
    minHeight: 44,
    justifyContent: "center",
  },
  item: {
    paddingVertical: 14,
    gap: 4,
  },
  place: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
});
