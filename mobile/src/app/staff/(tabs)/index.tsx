import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bell } from "@/components/bell";
import { onHallRefresh } from "@/hall-refresh";
import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { ListError } from "@/components/list-state";
import { SectionHead } from "@/components/section-head";
import { SkeletonRows } from "@/components/skeleton";
import { useDelayedLoading } from "@/use-delayed-loading";
import { setBadge } from "@/push";
import { runsOffice } from "@/office";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showActivitySkeleton = useDelayedLoading(loading && error === null) && error === null;
  const register = user ? readsRegister(user.role) : false;

  const reload = useCallback(() => {
    let active = true;
    setLoading(true);
    void staffRequest("/gate/activity?limit=6").then((reply) => {
      if (!active) {
        return;
      }
      setLoading(false);
      if (reply.ok) {
        setActivity(readActivity(reply.data));
        setError(null);
      } else {
        setError(trimStop(reply.message));
      }
    });
    if (register) {
      void staffRequest("/register/summary").then((reply) => {
        if (active && reply.ok) {
          const next = readSummary(reply.data);
          setSummary(next);
          if (next) {
            setBadge(next.unread);
          }
        }
      });
    }
    return () => {
      active = false;
    };
  }, [register, staffRequest]);

  useFocusEffect(reload);

  useEffect(() => {
    let stop = () => {};
    const off = onHallRefresh(() => {
      stop();
      stop = reload();
    });
    return () => {
      off();
      stop();
    };
  }, [reload]);

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
          {register ? <Bell count={summary?.unread ?? 0} href="/staff/notifications" /> : null}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Guests. Expected and in the hall"
        onPress={() => router.push("/staff/guests")}
        style={({ pressed }) => [
          styles.office,
          { backgroundColor: colors.surface, borderColor: colors.line },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[text.button, { color: colors.ink }]}>Guests</Text>
        <Text style={[text.error, { color: colors.inkSoft }]}>Expected and in the hall</Text>
      </Pressable>
      {register ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guest payments. Mark a stay paid and keep a receipt"
          onPress={() => router.push("/staff/payments")}
          style={({ pressed }) => [
            styles.office,
            { backgroundColor: colors.surface, borderColor: colors.line },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Guest payments</Text>
          <Text style={[text.error, { color: colors.inkSoft }]}>Mark a stay paid and keep a receipt</Text>
        </Pressable>
      ) : null}
      {runsOffice(user.role) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Office. People, places, and hall settings"
          onPress={() => router.push("/staff/office")}
          style={({ pressed }) => [
            styles.office,
            { backgroundColor: colors.surface, borderColor: colors.line },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[text.button, { color: colors.ink }]}>Office</Text>
          <Text style={[text.error, { color: colors.inkSoft }]}>People, places, and hall settings</Text>
        </Pressable>
      ) : null}
      <View style={[styles.section, { borderTopColor: colors.line }]}>
        <SectionHead title="Recent at the gate" />
        {showActivitySkeleton ? <SkeletonRows count={3} kind="row" /> : null}
        {error ? <ListError message={error} onRetry={() => { reload(); }} /> : null}
        {!showActivitySkeleton && activity && activity.length === 0 && !error ? (
          <Text style={[text.body, { color: colors.inkSoft }]}>No one has passed the gate yet</Text>
        ) : null}
        <View>
          {(showActivitySkeleton ? [] : (activity ?? [])).map((item, index, all) => (
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
  office: {
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 2 },
  pressed: { opacity: 0.6 },
});
