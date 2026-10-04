import { useCallback, useRef, useState } from "react";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatHallDate, formatWhen, formatWhenParts } from "@/format-when";
import { useSession, type HistoryItem, type HistoryKind } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const HALL_ZONE = "Asia/Kolkata";

type KindFilter = HistoryKind | "all";

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "late_night", label: "Late-night" },
  { id: "home_going", label: "Home going" },
  { id: "guest_stay", label: "Guest stays" },
  { id: "outing", label: "Outing" },
];

function hallDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALL_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dayFromHall(on: string): Date {
  const [year, month, day] = on.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6, 30));
}

function kindLabel(kind: HistoryKind): string {
  switch (kind) {
    case "late_night":
      return "Late-night";
    case "home_going":
      return "Home going";
    case "guest_stay":
      return "Guest stay";
    case "outing":
      return "Outing";
  }
}

function whenLine(item: HistoryItem): string {
  const start = formatWhenParts(item.startedAt);
  const end = formatWhenParts(item.endedAt);
  if (!start || !end) {
    return `${formatWhen(item.startedAt)} to ${formatWhen(item.endedAt)}`;
  }
  if (item.kind === "home_going" || item.kind === "guest_stay") {
    return start.day === end.day ? start.day : `${start.day} to ${end.day}`;
  }
  if (start.day === end.day) {
    return `${start.clock} to ${end.clock}, ${start.day}`;
  }
  return `${start.clock}, ${start.day} to ${end.clock}, ${end.day}`;
}

function recordedLine(item: HistoryItem): string | null {
  const names = [item.exitRecordedBy, item.returnRecordedBy].filter(
    (name): name is string => name !== null && name.length > 0,
  );
  const unique = [...new Set(names)];
  if (unique.length === 0) {
    return null;
  }
  return `Recorded by ${unique.join(" and ")}`;
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const colors = useHallColors();
  const title = item.who ?? item.place ?? kindLabel(item.kind);
  const recorded = recordedLine(item);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.place, { color: colors.ink }]}>{title}</Text>
        {item.unused ? (
          <View style={[styles.pill, { borderColor: colors.inkSoft, backgroundColor: colors.line }]}>
            <Text style={[styles.pillText, { color: colors.ink }]}>Unused</Text>
          </View>
        ) : null}
      </View>
      <Text style={[text.body, { color: colors.inkSoft }]}>{kindLabel(item.kind)}</Text>
      <Text style={[text.body, { color: colors.ink }]}>{whenLine(item)}</Text>
      {recorded ? <Text style={[text.body, { color: colors.inkSoft }]}>{recorded}</Text> : null}
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadHistory } = useSession();
  const [kind, setKind] = useState<KindFilter>("all");
  const [on, setOn] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    void loadHistory({ kind, on }).then((result) => {
      if (id !== requestId.current) {
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
  }, [kind, loadHistory, on]);

  useFocusEffect(load);

  const back = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.navigate("/settings");
  };

  const chooseDay = (date: Date) => {
    const next = hallDate(date);
    if (next === on) {
      return;
    }
    setOn(next);
    setPickerKey((key) => key + 1);
  };

  const openAndroidDate = () => {
    DateTimePickerAndroid.open({
      value: on ? dayFromHall(on) : new Date(),
      mode: "date",
      timeZoneName: HALL_ZONE,
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          chooseDay(date);
        }
      },
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
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>History</Text>
      <View accessibilityRole="tablist" style={styles.filters}>
        {KIND_FILTERS.map((item) => {
          const selected = kind === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setKind(item.id)}
              style={({ pressed }) => [styles.filter, pressed && styles.pressed]}
            >
              <Text style={[text.button, { color: selected ? colors.forest : colors.inkSoft }]}>
                {item.label}
              </Text>
              <View style={[styles.filterMark, { backgroundColor: selected ? colors.forest : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.dateField}>
        <Text style={[text.label, { color: colors.inkSoft }]}>Date</Text>
        <View style={styles.dateRow}>
          {Platform.OS === "android" ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Date" onPress={openAndroidDate} style={styles.datePress}>
              <Text style={[text.field, { color: on ? colors.ink : colors.inkFaint }]}>
                {on ? formatHallDate(on) : "Any day"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{on ? formatHallDate(on) : "Any day"}</Text>
              <DateTimePicker
                key={pickerKey}
                style={styles.chipHit}
                value={on ? dayFromHall(on) : new Date()}
                mode="date"
                display="compact"
                accentColor={colors.forest}
                themeVariant="light"
                timeZoneName={HALL_ZONE}
                onValueChange={(_event, date) => {
                  if (date) {
                    chooseDay(date);
                  }
                }}
              />
            </View>
          )}
          {on ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Any day" onPress={() => setOn(null)} style={styles.anyDay}>
              <Text style={[text.button, { color: colors.inkSoft }]}>Any day</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {failed ? <Text style={[text.error, { color: colors.danger }]}>History didn't load.</Text> : null}
      {items !== null && items.length === 0 && !failed ? (
        <Text style={[text.body, { color: colors.inkFaint }]}>No history</Text>
      ) : null}
      {items !== null && items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item) => (
            <HistoryRow key={item.id} item={item} />
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
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  title: { textAlign: "left" },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
    rowGap: 4,
  },
  filter: { minHeight: 44, justifyContent: "flex-end", gap: 8 },
  filterMark: { height: 2, borderRadius: 1 },
  dateField: { gap: 8 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  datePress: { minHeight: 44, justifyContent: "center" },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: "#C7C7CC",
    borderRadius: 8,
    minHeight: 34,
    paddingHorizontal: 11,
    justifyContent: "center",
    overflow: "hidden",
  },
  chipText: {
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
    lineHeight: 22,
    color: "#14261F",
  },
  chipHit: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
  },
  anyDay: { minHeight: 44, justifyContent: "center" },
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
  pill: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: { opacity: 0.6 },
});
