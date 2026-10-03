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

import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { TextField } from "@/components/text-field";
import { formatWhen, utcInstant } from "@/format-when";
import { outingLocked, useSession, type UpcomingOuting } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { OTHER_NAME, WhenField, hallDay, leaveNote, returnNote } from "@/outing-when";

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
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whereHeight, setWhereHeight] = useState(0);
  const whereOpen = useRef(new Animated.Value(0)).current;
  const pending = useRef(false);

  const refresh = useCallback(() => {
    let active = true;
    void loadResidentHome().then((result) => {
      if (!active || result.error !== null) {
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
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => dismissOpenChoice());
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
  const fieldsOpen = mayPlan && (today.length === 0 || reveal);
  const whereReady = !other || where.trim().length > 0;
  const planReady = destinationId !== null && leaveAt !== null && backBy !== null && whereReady;
  const leaveProblem = leaveNote(leaveAt);
  const returnProblem = returnNote(leaveAt, backBy);

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
    setDestinationId(null);
    setLeaveAt(null);
    setBackBy(null);
    setWhere("");
    setReveal(false);
    setError(null);
    refresh();
  }, [backBy, destinationId, leaveAt, other, planOuting, planReady, refresh, where]);

  const onWhereLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (height > 0) {
      setWhereHeight(height);
    }
  }, []);

  if (!user) {
    return null;
  }

  const room = roomLabel && roomLabel.length > 0 ? roomLabel : null;
  const rows = (items: UpcomingOuting[]) =>
    items.map((item) => <OutingRow key={item.id} item={item} />);

  const fields = fieldsOpen && places ? (
    <View style={styles.fields}>
      <ChoiceField
        label="Place"
        valueLabel={chosen?.name ?? null}
        items={places.map((item) => ({ id: item.id, label: item.name }))}
        selectedId={destinationId}
        onPick={(id) => {
          setDestinationId(id);
          if (places.find((item) => item.id === id)?.name !== OTHER_NAME) {
            setWhere("");
          }
          setError(null);
        }}
        colors={colors}
        openShowsAll
        note={null}
      />
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
      <Animated.View
        pointerEvents={other ? "auto" : "none"}
        style={{
          height: whereOpen.interpolate({
            inputRange: [0, 1],
            outputRange: [0, whereHeight],
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan"
        accessibilityState={{ disabled: !planReady }}
        disabled={!planReady}
        onPress={() => {
          if (!destinationId) {
            setError("Choose a place.");
            return;
          }
          if (other && where.trim().length === 0) {
            setError("Say where.");
            return;
          }
          void submit();
        }}
      >
        <Text style={[text.body, { color: planReady ? colors.forest : colors.inkFaint }]}>Plan</Text>
      </Pressable>
      {error ? <Text style={[text.error, { color: colors.danger }]}>{error}</Text> : null}
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
      <Pressable style={styles.dismiss} onPress={dismissOpenChoice}>
        <View style={styles.block}>
          <View style={styles.identity}>
            {fullName ? (
              <Text selectable style={[text.hallName, styles.title, { color: colors.ink }]}>
                {`Welcome, ${fullName}`}
              </Text>
            ) : null}
            {room ? (
              <Text selectable style={[text.body, { color: colors.inkSoft }]}>
                {room}
              </Text>
            ) : null}
          </View>
          {loaded && out ? (
            <Text style={[text.body, { color: colors.ink }]}>You are out.</Text>
          ) : null}
          {loaded && !out && windowOpen ? (
            <Text style={[text.body, { color: colors.ink }]}>
              You cannot start another outing while one is inside its window.
            </Text>
          ) : null}
          {today.length === 0 && mayPlan ? fields : null}
          {today.length > 0 || later.length > 0 ? (
            <View style={styles.list}>
              {rows(today)}
              {rows(later)}
            </View>
          ) : null}
          {today.length > 0 && mayPlan ? (
            <View style={styles.fields}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Plan an outing"
                onPress={() => setReveal(true)}
              >
                <Text style={[text.body, { color: colors.ink }]}>Plan an outing</Text>
              </Pressable>
              {reveal ? fields : null}
            </View>
          ) : null}
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
  list: { gap: 16 },
  rowLines: { gap: 2 },
  place: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
});
