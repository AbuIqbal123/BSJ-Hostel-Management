import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dismissOpenChoice } from "@/components/choice-field";
import { TextField } from "@/components/text-field";
import { formatWhen, utcInstant } from "@/format-when";
import { outingLocked, useSession, type UpcomingOuting } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import {
  OTHER_NAME,
  WhenField,
  dismissOpenWhen,
  hallDay,
  leaveNote,
  returnNote,
  useOneOpen,
} from "@/outing-when";

const WHERE_MS = 220;

function outingWhen(item: UpcomingOuting): string {
  const back = `Back ${formatWhen(item.expectedReturnAt)}`;
  if (!item.startsAt) {
    return back;
  }
  return `Leave ${formatWhen(item.startsAt)}. ${back}`;
}

function leaveIsToday(item: UpcomingOuting): boolean {
  if (!item.startsAt) {
    return false;
  }
  const leave = new Date(item.startsAt);
  if (Number.isNaN(leave.getTime())) {
    return false;
  }
  return hallDay(leave) === hallDay(new Date());
}

function OutingRow({ item }: { item: UpcomingOuting }) {
  const colors = useHallColors();
  const lines = (
    <View style={styles.rowLines}>
      <Text style={[styles.place, { color: colors.ink }]}>{item.place}</Text>
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
    >
      {lines}
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { user, loadResidentHome, loadDestinations, planOuting } = useSession();
  const [fullName, setFullName] = useState<string | null>(null);
  const [roomLabel, setRoomLabel] = useState<string | null>(null);
  const [out, setOut] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [upcoming, setUpcoming] = useState<UpcomingOuting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [places, setPlaces] = useState<{ id: string; name: string }[] | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [leaveAt, setLeaveAt] = useState<Date | null>(null);
  const [backBy, setBackBy] = useState<Date | null>(null);
  const [where, setWhere] = useState("");
  const [placeOpen, setPlaceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whereHeight, setWhereHeight] = useState(0);
  const whereOpen = useRef(new Animated.Value(0)).current;
  const pending = useRef(false);

  const refresh = useCallback(() => {
    let active = true;
    void loadResidentHome().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setError(result.error);
        setLoaded(true);
        return;
      }
      setFullName(result.home.fullName);
      setRoomLabel(result.home.roomLabel);
      setOut(result.home.out);
      setWindowOpen(result.home.windowOpen);
      setUpcoming(result.home.upcoming);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [loadResidentHome]);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      return dismissOpenWhen() || dismissOpenChoice();
    });
    return () => subscription.remove();
  }, []);

  const mayPlan = loaded && !out && !windowOpen;
  const chosen = places?.find((item) => item.id === destinationId) ?? null;
  const other = chosen?.name === OTHER_NAME;

  useEffect(() => {
    if (!mayPlan || places) {
      return;
    }
    let active = true;
    void loadDestinations().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setPlaces(result.items);
    });
    return () => {
      active = false;
    };
  }, [loadDestinations, mayPlan, places]);

  useEffect(() => {
    Animated.timing(whereOpen, {
      toValue: other ? 1 : 0,
      duration: WHERE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [other, whereHeight, whereOpen]);

  const today = upcoming.filter(leaveIsToday);
  const later = upcoming.filter((item) => !leaveIsToday(item));
  const whereReady = !other || where.trim().length > 0;
  const leaveProblem = leaveNote(leaveAt);
  const returnProblem = returnNote(leaveAt, backBy);
  const planReady =
    destinationId !== null &&
    leaveAt !== null &&
    backBy !== null &&
    whereReady &&
    leaveProblem === null &&
    returnProblem === null;

  const submit = useCallback(async () => {
    if (pending.current || !planReady || !destinationId || !leaveAt || !backBy) {
      return;
    }
    if (leaveNote(leaveAt) || returnNote(leaveAt, backBy)) {
      setError(null);
      return;
    }
    const placeText = where.trim();
    if (other && placeText.length === 0) {
      setError("Say where.");
      return;
    }
    pending.current = true;
    const message = await planOuting({
      destination_id: destinationId,
      starts_at: utcInstant(leaveAt),
      expected_return_at: utcInstant(backBy),
      ...(other ? { destination_text: placeText } : {}),
    });
    pending.current = false;
    if (message) {
      setError(message);
      return;
    }
    dismissOpenWhen();
    setDestinationId(null);
    setLeaveAt(null);
    setBackBy(null);
    setWhere("");
    setPlaceOpen(false);
    setError(null);
    refresh();
  }, [backBy, destinationId, leaveAt, other, planOuting, planReady, refresh, where]);

  const onWhereLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (height > 0) {
      setWhereHeight(height);
    }
  }, []);

  const closePlace = useCallback(() => {
    setPlaceOpen(false);
  }, []);
  useOneOpen(placeOpen, closePlace);

  if (!user) {
    return null;
  }

  const room = roomLabel && roomLabel.length > 0 ? roomLabel : null;
  const rows = (items: UpcomingOuting[]) =>
    items.map((item) => <OutingRow key={item.id} item={item} />);

  const planCard = mayPlan && places ? (
    <View style={styles.fields}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan an outing"
        onPress={() => {
          if (!planReady) {
            return;
          }
          void submit();
        }}
      >
        <Text
          style={[
            text.button,
            styles.planTitle,
            { color: planReady ? colors.forest : colors.ink },
          ]}
        >
          Plan an outing
        </Text>
      </Pressable>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chosen ? `Place, ${chosen.name}` : "Place, Choose a place"}
          accessibilityState={{ expanded: placeOpen }}
          onPress={() => {
            setPlaceOpen((current) => !current);
          }}
          style={styles.row}
        >
          <Text style={[text.label, { color: placeOpen ? colors.forest : colors.inkSoft }]}>Place</Text>
          <Text style={[text.field, { color: chosen ? colors.ink : colors.inkFaint }]}>
            {chosen?.name ?? "Choose a place"}
          </Text>
        </Pressable>
        {placeOpen ? (
          <View style={styles.choices}>
            {places.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: item.id === destinationId }}
                onPress={() => {
                  setDestinationId(item.id);
                  if (item.name !== OTHER_NAME) {
                    setWhere("");
                  }
                  setError(null);
                  setPlaceOpen(false);
                }}
              >
                <Text style={[text.field, { color: item.id === destinationId ? colors.forest : colors.ink }]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Animated.View
          pointerEvents={other ? "auto" : "none"}
          style={{
            height: whereOpen.interpolate({
              inputRange: [0, 1],
              outputRange: [0, whereHeight],
            }),
            marginTop: whereOpen.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 16],
            }),
            opacity: whereOpen,
            overflow: "hidden",
          }}
        >
          <View onLayout={onWhereLayout}>
            <TextField
              label="Where"
              value={where}
              onChangeText={(value) => {
                setWhere(value);
                setError(null);
              }}
              autoCapitalize="sentences"
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={() => {
                void submit();
              }}
            />
          </View>
        </Animated.View>
      </View>
      <WhenField
        label="Leave at"
        value={leaveAt}
        pastNote={leaveProblem}
        onChange={(date) => {
          setLeaveAt(date);
          setError(null);
        }}
      />
      <WhenField
        label="Back by"
        value={backBy}
        pastNote={returnProblem}
        onChange={(date) => {
          setBackBy(date);
          setError(null);
        }}
      />
      {error ? <Text style={[text.error, styles.planNote, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  ) : null;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={styles.dismiss}
        onPress={() => {
          dismissOpenWhen();
          dismissOpenChoice();
        }}
      >
        <View style={styles.block}>
          <View style={styles.identity}>
            <Text selectable style={[text.hallName, styles.title, { color: colors.ink }]}>
              {`Welcome, ${fullName ?? user.full_name}`}
            </Text>
            {room ? (
              <Text selectable style={[text.body, { color: colors.inkSoft }]}>
                {room}
              </Text>
            ) : null}
          </View>
          {error && !planCard ? (
            <Text style={[text.error, { color: colors.danger }]}>{error}</Text>
          ) : null}
          {loaded && out ? (
            <Text style={[text.body, { color: colors.ink }]}>You are out.</Text>
          ) : null}
          {loaded && !out && windowOpen ? (
            <Text style={[text.body, { color: colors.ink }]}>
              You cannot start another outing while one is inside its window.
            </Text>
          ) : null}
          {today.length > 0 || later.length > 0 ? (
            <View style={styles.list}>
              {rows(today)}
              {rows(later)}
            </View>
          ) : null}
          {planCard}
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  dismiss: { flexGrow: 1 },
  block: { gap: 28 },
  identity: { gap: 16 },
  title: { textAlign: "left" },
  fields: { gap: 16 },
  planTitle: { textAlign: "left" },
  planNote: { textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  choices: { gap: 16, marginTop: 16 },
  list: { gap: 16 },
  rowLines: { gap: 2 },
  place: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
});
