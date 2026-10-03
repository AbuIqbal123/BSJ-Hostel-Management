import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatWhen } from "@/format-when";
import { outingLocked, useSession, type UpcomingOuting } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function outingWhen(item: UpcomingOuting): string {
  const back = `Back ${formatWhen(item.expectedReturnAt)}`;
  if (!item.startsAt) {
    return back;
  }
  return `Leave ${formatWhen(item.startsAt)}. ${back}`;
}

function OutingRow({ item }: { item: UpcomingOuting }) {
  const colors = useHallColors();
  const lines = (
    <View style={styles.rowLines}>
      <Text style={[text.body, { color: colors.ink }]}>{item.place}</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{outingWhen(item)}</Text>
    </View>
  );
  if (!item.canModify || outingLocked(item.id)) {
    return lines;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.place}. ${outingWhen(item)}`}
      onPress={() => {
        router.navigate({
          pathname: "/plan",
          params: {
            outing: item.id,
            place: item.place,
            startsAt: item.startsAt ?? "",
            expectedReturnAt: item.expectedReturnAt,
          },
        });
      }}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {lines}
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { user, loadResidentHome } = useSession();
  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [blockName, setBlockName] = useState<string | null>(null);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingOuting[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadResidentHome().then((result) => {
        if (!active || result.error !== null) {
          return;
        }
        setFullName(result.home.fullName);
        setBlockName(result.home.blockName);
        setRoomLabel(result.home.roomLabel);
        setUpcoming(result.home.upcoming);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [loadResidentHome]),
  );

  if (!user) {
    return null;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.block}>
        <View style={styles.fields}>
          {fullName ? (
            <Text selectable style={[text.hallName, styles.name, { color: colors.ink }]}>
              {fullName}
            </Text>
          ) : null}
          {blockName ? (
            <Text selectable style={[text.body, { color: colors.inkSoft }]}>
              {blockName}
            </Text>
          ) : null}
          {roomLabel ? (
            <Text selectable style={[text.body, { color: colors.inkSoft }]}>
              {roomLabel}
            </Text>
          ) : null}
        </View>
        {loaded && upcoming.length === 0 ? (
          <Text style={[text.body, { color: colors.inkSoft }]}>Nothing upcoming.</Text>
        ) : null}
        {upcoming.length > 0 ? (
          <View style={styles.list}>
            {upcoming.map((item) => (
              <OutingRow key={item.id} item={item} />
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  block: { gap: 28 },
  fields: { gap: 16 },
  list: { gap: 16 },
  rowLines: { gap: 2 },
  name: { textAlign: "left" },
});
