import { useCallback, useEffect, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Alert, InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { StatusPill } from "@/components/status-pill";
import { TextField } from "@/components/text-field";
import { HALL_ZONE, formatChipDay, formatHallDate, hallNow } from "@/format-when";
import { GUEST_RELATIONS as RELATIONS, OTHER_RELATION, guestRelationFields as relationFields } from "@/guest-form";
import { hallDay } from "@/outing-when";
import { paymentLabel } from "@/payment-file";
import { guestLine } from "@/requests";
import { paramText } from "@/route-param";
import { useSession, type GuestStay, type GuestStayCard } from "@/session";
import { useDark } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { EASE_OUT } from "@/theme/motion";
import { text } from "@/theme/text";

function HallDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const dark = useDark();
  const colors = useHallColors();
  const [pickerKey, setPickerKey] = useState(0);
  const shown = value ?? hallNow();
  const dayLabel = formatChipDay(shown);
  const open = () => {
    DateTimePickerAndroid.open({
      value: shown,
      mode: "date",
      timeZoneName: HALL_ZONE,
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          onChange(date);
        }
      },
    });
  };
  return (
    <View style={styles.dateField}>
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      {Platform.OS === "android" ? (
        <Pressable accessibilityRole="button" onPress={open} style={styles.datePress}>
          <Text style={[text.field, { color: value ? colors.ink : colors.inkFaint }]}>
            {value ? formatHallDate(hallDay(value)) : "Choose a date"}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.chip, { backgroundColor: colors.chip }]}>
          <Text style={[styles.chipText, { color: colors.ink }]}>{value ? dayLabel : "Choose a date"}</Text>
          <DateTimePicker
            key={pickerKey}
            style={styles.chipHit}
            value={shown}
            mode="date"
            display="compact"
            accentColor={colors.forest}
            themeVariant={dark ? "dark" : "light"}
            timeZoneName={HALL_ZONE}
            onValueChange={(_event, date) => {
              if (!date || (value !== null && hallDay(date) === hallDay(value))) {
                return;
              }
              onChange(date);
              setPickerKey((key) => key + 1);
            }}
          />
        </View>
      )}
    </View>
  );
}

function useLeave() {
  const navigation = useNavigation();
  const leaving = useRef(false);
  return useCallback(() => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    goBackOr(navigation, "/permissions");
  }, [navigation]);
}

function dateOnHall(value: string): Date {
  return new Date(`${value}T12:00:00+05:30`);
}

function DecisionSummary({ stay }: { stay: GuestStay }) {
  const colors = useHallColors();
  const rows: {
    key: string;
    label: string;
    value: string | null;
    status: "pending" | "approved" | "rejected";
    note: string | null;
  }[] = stay.decisions.map((decision, index) => ({
    key: `${decision.role}-${decision.decidedAt}-${index}`,
    label: decision.role === "roommate" ? "Roommate" : "Provost",
    value: decision.actorName,
    status: decision.decision,
    note: decision.note,
  }));
  if (stay.waitingOnRoommate) {
    rows.push({ key: "waiting-roommate", label: "Roommate", value: null, status: "pending", note: null });
  }
  if (stay.waitingOnProvost) {
    rows.push({ key: "waiting-provost", label: "Provost", value: null, status: "pending", note: null });
  }
  if (rows.length === 0) {
    return null;
  }
  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[
            styles.fact,
            index > 0 ? { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth } : null,
          ]}
        >
          <Text style={[text.label, { color: colors.inkSoft }]}>{row.label}</Text>
          <View style={styles.factLine}>
            {row.value ? (
              <Text selectable style={[text.body, styles.factValue, { color: colors.ink }]}>
                {row.value}
              </Text>
            ) : (
              <View style={styles.factValue} />
            )}
            <StatusPill status={row.status} />
          </View>
          {row.note ? (
            <Text selectable style={[text.body, { color: colors.inkSoft }]}>
              {row.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function GuestForm({ existing }: { existing?: GuestStay }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { submitGuestStay, updateGuestStay, cancelGuestStay } = useSession();
  const back = useLeave();
  const seeded = existing ? relationFields(existing.relation) : null;
  const formOpacity = useSharedValue(1);
  const formShift = useSharedValue(0);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.92);
  const lineOpacity = useSharedValue(0);
  const lineShift = useSharedValue(8);
  const [name, setName] = useState(existing?.guestName ?? "");
  const [relationId, setRelationId] = useState<string | null>(seeded?.id ?? null);
  const [otherRelation, setOtherRelation] = useState(seeded?.other ?? "");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [start, setStart] = useState<Date | null>(existing ? dateOnHall(existing.startDate) : null);
  const [end, setEnd] = useState<Date | null>(existing ? dateOnHall(existing.endDate) : null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const pending = useRef(false);
  const startDate = start ? hallDay(start) : "";
  const endDate = end ? hallDay(end) : "";
  const relation =
    relationId === OTHER_RELATION ? otherRelation.trim() : (relationId ?? "");
  const ready =
    name.trim().length > 0 &&
    relation.length > 0 &&
    reason.trim().length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    endDate >= startDate;

  const submit = async () => {
    if (!ready || pending.current) {
      return;
    }
    pending.current = true;
    setError(null);
    const body = {
      guest_name: name.trim(),
      relation,
      guest_start_date: startDate,
      guest_end_date: endDate,
      reason: reason.trim(),
    };
    const failure = existing ? await updateGuestStay(existing.id, body) : await submitGuestStay(body);
    pending.current = false;
    if (failure) {
      setError(failure);
      return;
    }
    setSent(true);
  };

  useEffect(() => {
    if (!sent) {
      return;
    }
    formOpacity.set(withTiming(0, { duration: 220, easing: EASE_OUT }));
    markOpacity.set(withDelay(reduced ? 0 : 80, withTiming(1, { duration: reduced ? 180 : 280, easing: EASE_OUT })));
    lineOpacity.set(withDelay(reduced ? 40 : 160, withTiming(1, { duration: reduced ? 180 : 240, easing: EASE_OUT })));
    if (reduced) {
      markScale.set(1);
      lineShift.set(0);
    } else {
      formShift.set(withTiming(-8, { duration: 220, easing: EASE_OUT }));
      markScale.set(withDelay(80, withTiming(1, { duration: 280, easing: EASE_OUT })));
      lineShift.set(withDelay(160, withTiming(0, { duration: 240, easing: EASE_OUT })));
    }
    const timer = setTimeout(back, 1600);
    return () => clearTimeout(timer);
  }, [back, formOpacity, formShift, lineOpacity, lineShift, markOpacity, markScale, reduced, sent]);

  const formMotion = useAnimatedStyle(() => ({
    opacity: formOpacity.get(),
    transform: [{ translateY: formShift.get() }],
  }));
  const markMotion = useAnimatedStyle(() => ({
    opacity: markOpacity.get(),
    transform: [{ scale: markScale.get() }],
  }));
  const lineMotion = useAnimatedStyle(() => ({
    opacity: lineOpacity.get(),
    transform: [{ translateY: lineShift.get() }],
  }));

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
    <Animated.View
      pointerEvents={sent ? "none" : "auto"}
      accessibilityElementsHidden={sent}
      importantForAccessibility={sent ? "no-hide-descendants" : "auto"}
      style={[styles.screen, formMotion]}
    >
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Guest stay</Text>
      {existing ? <DecisionSummary stay={existing} /> : null}
      <Pressable style={styles.block} onPress={dismissOpenChoice}>
        <TextField
          label="Name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          autoComplete="off"
          maxLength={120}
        />
        <ChoiceField
          label="Relation"
          valueLabel={relationId}
          items={RELATIONS.map((item) => ({ id: item, label: item }))}
          selectedId={relationId}
          onPick={(id) => {
            setRelationId(id);
            if (id !== OTHER_RELATION) {
              setOtherRelation("");
            }
            setError(null);
          }}
          colors={colors}
          note={null}
          placeholder="Choose a relation"
        />
        {relationId === OTHER_RELATION ? (
          <TextField
            label="Which relation"
            value={otherRelation}
            onChangeText={(value) => {
              setOtherRelation(value);
              setError(null);
            }}
            autoComplete="off"
            maxLength={80}
          />
        ) : null}
        <TextField
          label="Reason"
          value={reason}
          onChangeText={(value) => {
            setReason(value);
            setError(null);
          }}
          autoCapitalize="sentences"
          autoComplete="off"
          maxLength={500}
        />
        <HallDate
          label="Arrives"
          value={start}
          onChange={(date) => {
            setStart(date);
            setEnd((current) => {
              const shown = current ?? hallNow();
              if (hallDay(shown) >= hallDay(date)) {
                return current;
              }
              return date;
            });
            setError(null);
          }}
        />
        <HallDate
          label="Leaves"
          value={end}
          onChange={(date) => {
            setEnd(date);
            setError(null);
          }}
        />
        {start && end && endDate < startDate ? (
          <Text accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>Leaves has to be on or after Arrives</Text>
        ) : null}
      </Pressable>
      <View style={styles.submit}>
        <HallButton
          label={existing ? "Save" : "Submit"}
          disabled={!ready}
          onPress={() => {
            setTimeout(() => {
              void submit();
            }, 50);
          }}
        />
      </View>
      {existing ? (
        <Pressable accessibilityRole="button" onPress={() => {
          Alert.alert("Cancel guest stay", undefined, [
            { text: "Back", style: "cancel" },
            {
              text: "Cancel guest stay",
              style: "destructive",
              onPress: () => {
                void (async () => {
                  const failure = await cancelGuestStay(existing.id);
                  if (!failure) {
                    back();
                    return;
                  }
                  setError(failure.message);
                })();
              },
            },
          ]);
        }} style={styles.cancel}>
          <Text style={[text.button, { color: colors.danger }]}>Cancel guest stay</Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
    </Animated.View>
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!sent}
      importantForAccessibility={sent ? "auto" : "no-hide-descendants"}
      style={[styles.sent, frame]}
    >
      <Animated.View style={[styles.sentMark, { backgroundColor: colors.forest }, markMotion]}>
        <Feather name="check" size={28} color={colors.onForest} />
      </Animated.View>
      <Animated.Text style={[text.body, styles.sentLine, { color: colors.ink }, lineMotion]}>
        {existing ? "Your changes have been sent for approval" : "Your request has been submitted"}
      </Animated.Text>
    </Animated.View>
    </View>
  );
}

function RoommateDecide({ card, onDone }: { card: GuestStayCard; onDone: () => void }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { decideGuestStay } = useSession();
  const back = useLeave();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const dates = `${formatHallDate(card.startDate)} to ${formatHallDate(card.endDate)}`;

  const choose = async (decision: "approved" | "rejected") => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    const failure = await decideGuestStay(card.id, decision);
    pending.current = false;
    setBusy(false);
    if (!failure) {
      onDone();
      return;
    }
    setError(failure);
  };

  const decline = () => {
    Alert.alert("Decline guest stay", undefined, [
      { text: "Back", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () => {
          void choose("rejected");
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <View style={styles.block}>
        <View style={styles.headingRow}>
          <Text style={[text.hallName, styles.title, styles.titleFlex, { color: colors.ink }]}>{card.guestName}</Text>
          <StatusPill status="pending" />
        </View>
        <Text style={[text.body, { color: colors.inkSoft }]}>{`${card.hostName}, ${card.hostRoomLabel}`}</Text>
        <Text style={[text.body, { color: colors.inkSoft }]}>{dates}</Text>
        <View style={styles.decide}>
          <View style={styles.decideHalf}>
            <HallButton label="Approve" busy={busy} onPress={() => void choose("approved")} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={decline}
            style={({ pressed }) => [
              styles.ghost,
              { borderColor: colors.line, backgroundColor: colors.surface, opacity: busy || pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[text.button, { color: colors.ink }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function GuestDetail({ id, preferDecide }: { id: string; preferDecide: boolean }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadGuestStay, loadAwaitingGuestStays, cancelGuestStay } = useSession();
  const back = useLeave();
  const [stay, setStay] = useState<GuestStay | null>(null);
  const [waiting, setWaiting] = useState<GuestStayCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const alertAt = useRef(0);

  const load = useCallback(() => {
    let active = true;
    void (async () => {
      const showWaiting = (listed: { error: string | null; items?: GuestStayCard[] }) => {
        const match = listed.error === null ? listed.items?.find((item) => item.id === id) : undefined;
        if (!match) {
          return false;
        }
        setWaiting(match);
        setStay(null);
        setError(null);
        return true;
      };
      if (preferDecide) {
        const listed = await loadAwaitingGuestStays();
        if (!active) {
          return;
        }
        if (listed.error !== null) {
          setWaiting(null);
          setStay(null);
          setError(listed.error);
          return;
        }
        if (showWaiting(listed)) {
          return;
        }
      }
      const result = await loadGuestStay(id);
      if (!active) {
        return;
      }
      if (result.error === null) {
        setStay(result.stay);
        setWaiting(null);
        setError(null);
        return;
      }
      if (!preferDecide) {
        const listed = await loadAwaitingGuestStays();
        if (!active) {
          return;
        }
        if (showWaiting(listed)) {
          return;
        }
        if (listed.error !== null) {
          setWaiting(null);
          setStay(null);
          setError(listed.error);
          return;
        }
      }
      setWaiting(null);
      setStay(null);
      setError(result.error);
    })();
    return () => {
      active = false;
    };
  }, [id, loadAwaitingGuestStays, loadGuestStay, preferDecide]);

  useFocusEffect(load);

  const leaveAfterAlert = useCallback(() => {
    const wait = Math.max(0, 250 - (Date.now() - alertAt.current));
    setTimeout(() => {
      InteractionManager.runAfterInteractions(back);
    }, wait);
  }, [back]);

  const confirmCancel = async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    const failure = await cancelGuestStay(id);
    pending.current = false;
    if (!failure) {
      leaveAfterAlert();
      return;
    }
    setError(failure.message);
  };

  const cancel = () => {
    Alert.alert("Cancel guest stay", undefined, [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel guest stay",
        style: "destructive",
        onPress: () => {
          alertAt.current = Date.now();
          void confirmCancel();
        },
      },
    ]);
  };

  const open =
    stay !== null &&
    stay.arrivedAt === null &&
    (stay.status === "pending" || stay.status === "approved");

  if (waiting) {
    return <RoommateDecide card={waiting} onDone={back} />;
  }

  if (stay?.status === "pending") {
    return <GuestForm existing={stay} />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      {stay ? (
        <View style={styles.block}>
          <Text style={[text.hallName, styles.title, { color: colors.ink }]}>{stay.guestName}</Text>
          <Text style={[text.body, { color: colors.ink }]}>{stay.relation}</Text>
          <Text style={[text.body, { color: colors.inkSoft }]}>
            {`${formatHallDate(stay.startDate)} to ${formatHallDate(stay.endDate)}`}
          </Text>
          <Text style={[text.body, { color: colors.ink }]}>{stay.reason}</Text>
          <Text style={[text.body, { color: colors.ink }]}>{guestLine(stay)}</Text>
          <Text style={[text.body, { color: colors.ink }]}>{paymentLabel(stay.paymentStatus)}</Text>
          <DecisionSummary stay={stay} />
          {stay.decisionNote ? (
            <Text style={[text.body, { color: colors.inkSoft }]}>{stay.decisionNote}</Text>
          ) : null}
          {open ? (
            <Pressable accessibilityRole="button" onPress={cancel} style={styles.cancel}>
              <Text style={[text.button, { color: colors.danger }]}>Cancel guest stay</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function GuestScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; decide?: string | string[] }>();
  const id = paramText(params.id).trim();
  const preferDecide = paramText(params.decide).trim() === "1";
  if (id.length > 0) {
    return <GuestDetail id={id} preferDecide={preferDecide} />;
  }
  return <GuestForm />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 28,
  },
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  title: { textAlign: "left" },
  titleFlex: { flex: 1 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  block: { gap: 16 },
  fact: { paddingVertical: 12, gap: 4 },
  factLine: { flexDirection: "row", alignItems: "center", gap: 12 },
  factValue: { flex: 1 },
  decide: { flexDirection: "row", gap: 12 },
  decideHalf: { flex: 1 },
  ghost: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateField: { gap: 8 },
  datePress: { minHeight: 44, justifyContent: "center" },
  chip: {
    alignSelf: "flex-start",
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
  },
  chipHit: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
  },
  submit: { marginTop: 8 },
  sent: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 28,
  },
  sentMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sentLine: { textAlign: "center" },
  cancel: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
});
