import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bell } from "@/components/bell";
import { onHallRefresh } from "@/hall-refresh";
import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { PagedList } from "@/components/paged-list";
import { RowHairline } from "@/components/plain-row";
import { SectionHead } from "@/components/section-head";
import { pageQuery } from "@/list-page";
import { setBadge } from "@/push";
import { useListPage } from "@/use-list-page";
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
  const register = user ? readsRegister(user.role) : false;
  const activity = useListPage<GateEvent>({
    auto: false,
    idOf: (item: GateEvent) => item.key,
    loadPage: async () => {
      const reply = await staffRequest(`/gate/activity?${pageQuery(0)}`);
      if (!reply.ok) {
        return { error: trimStop(reply.message) };
      }
      const items = readActivity(reply.data) ?? [];
      return { items, total: items.length };
    },
  });

  const reload = useCallback(() => {
    let active = true;
    activity.load();
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
  }, [activity.load, register, staffRequest]);

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
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guests. Expected and in the hall"
          onPress={() => router.push("/staff/guests")}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <View style={styles.linkCopy}>
            <Text numberOfLines={1} style={[styles.linkTitle, { color: colors.ink }]}>
              Guests
            </Text>
            <Text numberOfLines={1} style={[styles.linkDetail, { color: colors.inkSoft }]}>
              Expected and in the hall
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.inkFaint} />
        </Pressable>
        {register ? (
          <>
            <RowHairline />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guest payments. Mark a stay paid and keep a receipt"
              onPress={() => router.push("/staff/payments")}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <View style={styles.linkCopy}>
                <Text numberOfLines={1} style={[styles.linkTitle, { color: colors.ink }]}>
                  Guest payments
                </Text>
                <Text numberOfLines={1} style={[styles.linkDetail, { color: colors.inkSoft }]}>
                  Mark a stay paid and keep a receipt
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.inkFaint} />
            </Pressable>
          </>
        ) : null}
      </View>
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
      <View style={styles.section}>
        <PagedList
          rows={activity.rows}
          error={activity.error}
          pageError={activity.pageError}
          showListSkeleton={activity.showListSkeleton}
          showPageSkeleton={activity.showPageSkeleton}
          onRetry={activity.retry}
          onRetryPage={() => activity.loadNext(true)}
          skeletonCount={3}
          header={<SectionHead title="Recent at the gate" padTop={0} />}
          empty={<Text style={[text.body, { color: colors.inkSoft }]}>No one has passed the gate yet</Text>}
        >
          <View>
            {(activity.rows ?? []).map((item, index, all) => (
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
        </PagedList>
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
  link: {
    minHeight: 68,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linkCopy: { flex: 1, minWidth: 0, gap: 2 },
  linkTitle: { fontFamily: "SourceSans3_600SemiBold", fontSize: 17, lineHeight: 22 },
  linkDetail: { fontFamily: "SourceSans3_400Regular", fontSize: 15, lineHeight: 20 },
  office: {
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  section: { marginTop: 4 },
  pressed: { opacity: 0.6 },
});
