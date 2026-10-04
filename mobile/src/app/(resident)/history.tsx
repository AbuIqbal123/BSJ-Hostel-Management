import { useCallback, useEffect, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "expo-router";
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatHallDate, formatWhen, formatWhenParts } from "@/format-when";
import { useSession, type HistoryItem, type HistoryKind } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const HALL_ZONE = "Asia/Kolkata";

type KindFilter = HistoryKind | "all";

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "late_night", label: "Late night" },
  { id: "home_going", label: "Home going" },
  { id: "guest_stay", label: "Guest" },
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

function parseHallDay(on: string): Date {
  const [year, month, day] = on.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date();
  }
  // Noon-ish UTC keeps the Asia/Kolkata calendar day stable.
  return new Date(Date.UTC(year, month - 1, day, 6, 30));
}

function kindWord(kind: HistoryKind): string {
  switch (kind) {
    case "late_night":
      return "Late night";
    case "home_going":
      return "Home going";
    case "guest_stay":
      return "Guest";
    case "outing":
      return "Outing";
  }
}

function whenRange(item: HistoryItem): string {
  const start = formatWhenParts(item.startedAt);
  const end = formatWhenParts(item.endedAt);
  if (!start || !end) {
    return `${formatWhen(item.startedAt)} to ${formatWhen(item.endedAt)}`;
  }
  if (start.day === end.day) {
    return `${start.day}, ${start.clock} to ${end.clock}`;
  }
  return `${start.day}, ${start.clock} to ${end.day}, ${end.clock}`;
}

function sentence(item: HistoryItem): string {
  const when = whenRange(item);
  switch (item.kind) {
    case "late_night":
      return item.place ? `Late night to ${item.place}, ${when}` : `Late night, ${when}`;
    case "home_going":
      return item.place ? `Going home to ${item.place}, ${when}` : `Going home, ${when}`;
    case "guest_stay":
      return item.who ? `Guest ${item.who}, ${when}` : `Guest, ${when}`;
    case "outing":
      return item.place ? `Outing to ${item.place}, ${when}` : `Outing, ${when}`;
  }
}

export default function HistoryScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loadHistory } = useSession();
  const [kind, setKind] = useState<KindFilter>("all");
  const [on, setOn] = useState<string | null>(null);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => new Date());
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const dateTouched = useRef(false);

  const clearSettle = useCallback(() => {
    if (settleRef.current !== null) {
      clearTimeout(settleRef.current);
      settleRef.current = null;
    }
  }, []);

  const closeDate = useCallback(() => {
    clearSettle();
    dateTouched.current = false;
    setDateOpen(false);
  }, [clearSettle]);

  const openDate = useCallback(() => {
    clearSettle();
    dateTouched.current = false;
    setDraftDate(on ? parseHallDay(on) : new Date());
    setDateOpen(true);
  }, [clearSettle, on]);

  const toggleDate = useCallback(() => {
    if (dateOpen) {
      closeDate();
      return;
    }
    openDate();
  }, [closeDate, dateOpen, openDate]);

  const chooseAnyDay = useCallback(() => {
    clearSettle();
    dateTouched.current = false;
    setOn(null);
    setDateOpen(false);
  }, [clearSettle]);

  const chooseDay = useCallback(
    (date: Date) => {
      clearSettle();
      dateTouched.current = false;
      setOn(hallDate(date));
      setDateOpen(false);
    },
    [clearSettle],
  );

  const load = useCallback(() => {
    const id = ++requestId.current;
    void loadHistory({
      kind,
      on,
    }).then((result) => {
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

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (retryRef.current !== null) {
          clearTimeout(retryRef.current);
          retryRef.current = null;
        }
      };
    }, [load]),
  );

  useEffect(() => {
    if (!failed) {
      if (retryRef.current !== null) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      return;
    }
    retryRef.current = setTimeout(() => {
      retryRef.current = null;
      load();
    }, 2500);
    return () => {
      if (retryRef.current !== null) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [failed, load]);

  useEffect(() => {
    if (!dateOpen) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDate();
      return true;
    });
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      event.preventDefault();
      closeDate();
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [closeDate, dateOpen, navigation]);

  const dateLabel = on ? formatHallDate(on) : "Date";
  const dateColor = on ? colors.forest : colors.inkFaint;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      {dateOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss date"
          onPress={closeDate}
          style={styles.dismiss}
        />
      ) : null}

      <View
        style={[
          styles.chrome,
          { paddingTop: insets.top + 28, paddingHorizontal: 28, zIndex: 2 },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {KIND_FILTERS.map((item) => {
            const selected = kind === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (dateOpen) {
                    closeDate();
                  }
                  setKind(item.id);
                }}
                style={styles.filterHit}
              >
                <Text
                  style={[
                    text.button,
                    { color: selected ? colors.forest : colors.inkFaint },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={on ? `Date ${dateLabel}` : "Date"}
            onPress={toggleDate}
            style={styles.filterHit}
          >
            <Text style={[text.button, { color: dateColor }]}>{dateLabel}</Text>
          </Pressable>
        </ScrollView>

        {dateOpen ? (
          <View style={styles.wheel}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Any day"
              onPress={chooseAnyDay}
              style={styles.anyDay}
            >
              <Text
                style={[
                  text.button,
                  { color: on === null ? colors.forest : colors.inkFaint },
                ]}
              >
                Any day
              </Text>
            </Pressable>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              themeVariant="light"
              accentColor={colors.forest}
              timeZoneName={HALL_ZONE}
              style={styles.spinner}
              onChange={(_event, date) => {
                if (!date) {
                  return;
                }
                dateTouched.current = true;
                setDraftDate(date);
                clearSettle();
                settleRef.current = setTimeout(() => {
                  settleRef.current = null;
                  if (!dateTouched.current) {
                    return;
                  }
                  chooseDay(date);
                }, 450);
              }}
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <Text style={[text.error, { color: colors.danger }]}>History didn't load.</Text>
        ) : null}

        {items !== null && items.length === 0 && !failed ? (
          <Text style={[text.body, { color: colors.inkFaint }]}>No history</Text>
        ) : null}

        {items !== null && items.length > 0 ? (
          <View style={styles.list}>
            {items.map((item) => {
              const open = openId === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => setOpenId(open ? null : item.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Text style={[text.body, { color: colors.ink }]}>
                    {sentence(item)}
                    {item.unused ? (
                      <Text style={{ color: colors.inkFaint }}>{" Unused"}</Text>
                    ) : null}
                  </Text>
                  {open ? (
                    <View style={styles.facts}>
                      <Text style={[text.body, { color: colors.ink }]}>
                        {kindWord(item.kind)}
                      </Text>
                      {item.place ? (
                        <Text style={[text.body, { color: colors.ink }]}>{item.place}</Text>
                      ) : null}
                      {item.who ? (
                        <Text style={[text.body, { color: colors.ink }]}>{item.who}</Text>
                      ) : null}
                      <Text style={[text.body, { color: colors.ink }]}>
                        {`Leave ${formatWhen(item.startedAt)}`}
                      </Text>
                      <Text style={[text.body, { color: colors.ink }]}>
                        {`Return ${formatWhen(item.endedAt)}`}
                      </Text>
                      {item.exitRecordedBy ? (
                        <Text style={[text.body, { color: colors.ink }]}>
                          {`Exit recorded by ${item.exitRecordedBy}`}
                        </Text>
                      ) : null}
                      {item.returnRecordedBy ? (
                        <Text style={[text.body, { color: colors.ink }]}>
                          {`Return recorded by ${item.returnRecordedBy}`}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  chrome: {
    gap: 8,
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 16,
    paddingRight: 8,
  },
  filterHit: {
    minHeight: 44,
    justifyContent: "center",
  },
  wheel: {
    gap: 8,
  },
  anyDay: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  spinner: {
    alignSelf: "stretch",
    ...(Platform.OS === "ios" ? { height: 180 } : null),
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    gap: 28,
  },
  list: { gap: 20 },
  row: { gap: 10 },
  facts: { gap: 4 },
  pressed: { opacity: 0.6 },
});
