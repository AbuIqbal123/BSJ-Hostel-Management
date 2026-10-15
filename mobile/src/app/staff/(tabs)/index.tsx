import { useCallback, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { SectionHead } from "@/components/section-head";
import { roleLabel, useSession } from "@/session";
import { readActivity, readSummary, readsRegister, trimStop, type GateEvent, type RegisterSummary } from "@/staff";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function StatCard({ count, label, note, onPress }: { count: number; label: string; note: string; onPress: () => void }) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}. ${note}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.line },
        pressed && styles.pressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.count, { color: colors.ink }]}>
        {count}
      </Text>
      <Text numberOfLines={1} style={[styles.label, { color: colors.ink }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[styles.note, { color: colors.inkFaint }]}>
        {note}
      </Text>
    </Pressable>
  );
}

export default function StaffHomeScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { user, staffRequest } = useSession();
  const [summary, setSummary] = useState<RegisterSummary | null>(null);
  const [activity, setActivity] = useState<GateEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const register = user ? readsRegister(user.role) : false;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void staffRequest("/gate/activity?limit=6").then((reply) => {
        if (!active) {
          return;
        }
        if (reply.ok) {
          setActivity(readActivity(reply.data));
        } else {
          setError(trimStop(reply.message));
        }
      });
      if (register) {
        void staffRequest("/register/summary").then((reply) => {
          if (active && reply.ok) {
            setSummary(readSummary(reply.data));
          }
        });
      }
      return () => {
        active = false;
      };
    }, [register, staffRequest]),
  );

  if (!user) {
    return null;
  }
  const requests = summary ? summary.pendingPermissions + summary.pendingGuests : 0;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identity}>
        <View style={styles.welcomeRow}>
          <Text numberOfLines={1} style={[text.hallName, styles.title, { color: colors.ink }]}>
            {`Welcome, ${user.full_name}`}
          </Text>
          {register ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={12}
              onPress={() => router.push("/staff/notifications")}
              style={[styles.bell, { backgroundColor: colors.ink }]}
            >
              <Feather name="bell" size={16} color={colors.paper} />
              {summary?.unread ? (
                <View style={[styles.dot, { backgroundColor: colors.forest, borderColor: colors.paper }]} />
              ) : null}
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[text.body, { color: colors.inkSoft }]}>
          {roleLabel(user.role)}
        </Text>
      </View>
      {register ? (
        <View style={styles.stats}>
          <StatCard
            count={summary?.out ?? 0}
            label="Out now"
            note={`${summary?.late ?? 0} late`}
            onPress={() => router.push("/staff/out")}
          />
          <StatCard
            count={requests}
            label="Requests"
            note={`${summary?.pendingPermissions ?? 0} + ${summary?.pendingGuests ?? 0} guests`}
            onPress={() => router.push("/staff/requests")}
          />
        </View>
      ) : (
        <HallButton label="Scan a hall pass" onPress={() => router.push("/staff/scan")} />
      )}
      <View style={[styles.section, { borderTopColor: colors.line }]}>
        <SectionHead title="Recent at the gate" />
        {error ? <Text style={[text.error, { color: colors.danger }]}>{error}</Text> : null}
        {activity && activity.length === 0 ? (
          <Text style={[text.body, { color: colors.inkSoft }]}>No one has passed the gate yet</Text>
        ) : null}
        <View>
          {(activity ?? []).map((item, index, all) => (
            <DenseRow
              key={item.key}
              title={item.title}
              detail={item.detail}
              time={item.at}
              first={index === 0}
              last={index === all.length - 1}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 28 },
  identity: { gap: 16 },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  title: { flex: 1, textAlign: "left" },
  bell: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  count: { fontFamily: "SourceSerif4_600SemiBold", fontSize: 34, lineHeight: 42, letterSpacing: -0.6 },
  label: { fontFamily: "SourceSans3_600SemiBold", fontSize: 15, lineHeight: 20, marginTop: 2 },
  note: { fontFamily: "SourceSans3_400Regular", fontSize: 13, lineHeight: 18 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 2 },
  pressed: { opacity: 0.6 },
});
