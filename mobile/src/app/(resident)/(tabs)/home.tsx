import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { BackHandler, InteractionManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { TextField } from "@/components/text-field";
import { formatWhenParts, utcInstant } from "@/format-when";
import { outingLocked, takeOutingLeft, useSession, type UpcomingOuting } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";
import { OTHER_NAME, WhenField, hallDay, leaveNote, notBefore, returnNote } from "@/outing-when";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ROW_ENTER = FadeIn.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const ROW_EXIT = FadeOut.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const ROW_MOVE = LinearTransition.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
let rowsMayEnter = false;

function OutingFrame({ item }: { item: UpcomingOuting }) {
  const entering = useRef(rowsMayEnter ? ROW_ENTER : undefined);
  return (
    <Animated.View
      collapsable={false}
      entering={entering.current}
      exiting={ROW_EXIT}
      layout={ROW_MOVE}
    >
      <OutingRow item={item} />
    </Animated.View>
  );
}

function outingWhen(item: UpcomingOuting): { day: string; span: string } {
  const back = formatWhenParts(item.expectedReturnAt);
  const leave = item.startsAt ? formatWhenParts(item.startsAt) : null;
  if (!back) {
    return { day: item.expectedReturnAt, span: "" };
  }
  if (!leave) {
    return { day: back.day, span: `Back ${back.clock}` };
  }
  if (leave.day === back.day) {
    return { day: leave.day, span: `${leave.clock} to ${back.clock}` };
  }
  return { day: leave.day, span: `${leave.clock} to ${back.clock}, ${back.day}` };
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
  const when = outingWhen(item);
  const lines = (
    <View style={styles.rowLines}>
      <Text style={[styles.place, { color: colors.ink }]}>{item.place}</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{when.day}</Text>
      {when.span ? <Text style={[text.mono, { color: colors.ink }]}>{when.span}</Text> : null}
    </View>
  );
  const shell = [styles.outing, { backgroundColor: colors.surface, borderColor: colors.line }];
  if (!item.canModify || outingLocked(item.id)) {
    return <View style={shell}>{lines}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.place}. ${when.day}. ${when.span}`}
      style={shell}
      onPress={() => {
        router.push({
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
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const holdConfirm = useRef(0);

  const refresh = useCallback(() => {
    let active = true;
    const left = takeOutingLeft();
    if (left) {
      setUpcoming((items) => items.filter((item) => item.id !== left));
    }
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

  const opened = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!opened.current) {
        opened.current = true;
        return refresh();
      }
      let stop = () => {};
      const task = InteractionManager.runAfterInteractions(() => {
        stop = refresh();
      });
      return () => {
        task.cancel();
        stop();
      };
    }, [refresh]),
  );

  useEffect(() => {
    if (loaded) {
      rowsMayEnter = true;
    }
  }, [loaded]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      return dismissOpenChoice();
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

  const holdPlan = useCallback(() => {
    holdConfirm.current = Date.now() + 700;
  }, []);

  const submit = useCallback(async () => {
    if (Date.now() < holdConfirm.current) {
      return;
    }
    if (pending.current || !planReady || !destinationId || !leaveAt || !backBy) {
      return;
    }
    pending.current = true;
    const message = await planOuting({
      destination_id: destinationId,
      starts_at: utcInstant(leaveAt),
      expected_return_at: utcInstant(backBy),
      ...(other ? { destination_text: where.trim() } : {}),
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
    setError(null);
    refresh();
  }, [backBy, destinationId, leaveAt, other, planOuting, planReady, refresh, where]);

  if (!user) {
    return null;
  }

  const room = roomLabel && roomLabel.length > 0 ? roomLabel : null;
  const rows = (items: UpcomingOuting[]) =>
    items.map((item) => <OutingFrame key={item.id} item={item} />);

  const planCard = mayPlan && places ? (
    <View style={styles.fields}>
      <Text style={[text.button, styles.title, { color: colors.ink }]}>Plan an outing</Text>
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
        note={null}
        placeholder="Choose a place"
      />
      {other ? (
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
      ) : null}
      <WhenField
        label="Leave at"
        value={leaveAt}
        note={leaveProblem}
        onAdjust={holdPlan}
        onChange={(date) => {
          if (!date) {
            return;
          }
          setLeaveAt(date);
          setBackBy((current) => notBefore(date, current));
          setError(null);
        }}
      />
      <WhenField
        label="Back by"
        value={backBy}
        note={returnProblem}
        onAdjust={holdPlan}
        onChange={(date) => {
          setBackBy(date);
          setError(null);
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Confirm"
        accessibilityState={{ disabled: !planReady }}
        disabled={!planReady}
        hitSlop={12}
        onPress={() => {
          setTimeout(() => {
            void submit();
          }, 50);
        }}
        style={styles.confirm}
      >
        <Text style={[text.button, { color: planReady ? colors.forest : colors.inkFaint }]}>
          Confirm
        </Text>
      </Pressable>
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
        onPress={dismissOpenChoice}
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
          {planCard}
          {today.length > 0 || later.length > 0 ? (
            <Animated.View
              collapsable={false}
              layout={ROW_MOVE}
              exiting={ROW_EXIT}
              style={[styles.upcoming, { borderTopColor: colors.line }]}
            >
              <Text style={[text.button, { color: colors.ink }]}>Upcoming outings</Text>
              <Animated.View style={styles.list} layout={ROW_MOVE}>
                {today.length > 0 && later.length > 0 ? (
                  <Animated.Text
                    exiting={ROW_EXIT}
                    layout={ROW_MOVE}
                    style={[text.label, { color: colors.inkSoft }]}
                  >
                    Today
                  </Animated.Text>
                ) : null}
                {rows(today)}
                {today.length > 0 && later.length > 0 ? (
                  <Animated.Text
                    exiting={ROW_EXIT}
                    layout={ROW_MOVE}
                    style={[text.label, { color: colors.inkSoft }]}
                  >
                    Later
                  </Animated.Text>
                ) : null}
                {rows(later)}
              </Animated.View>
            </Animated.View>
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
  confirm: { alignSelf: "flex-start" },
  planNote: { textAlign: "center" },
  upcoming: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 22,
    gap: 14,
  },
  list: { gap: 12 },
  outing: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLines: { gap: 4 },
  place: {
    fontFamily: "SourceSerif4_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.2,
  },
});
