import { useCallback, useEffect, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Alert, InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { guestLine } from "@/app/(resident)/(tabs)/permissions";
import { formatHallDate } from "@/format-when";
import { useSession, type GuestStay } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const HALL_ZONE = "Asia/Kolkata";
const OTHER_RELATION = "Other";
const RELATIONS = [
  "Mother",
  "Father",
  "Sister",
  "Brother",
  "Guardian",
  "Aunt",
  "Uncle",
  "Cousin",
  "Grandmother",
  "Grandfather",
  OTHER_RELATION,
];

function paramText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return raw.trim();
}

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

function HallDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const colors = useHallColors();
  const [pickerKey, setPickerKey] = useState(0);
  const shown = value ?? new Date();
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALL_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(shown);
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
            {value ? formatHallDate(hallDate(value)) : "Choose a date"}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{value ? dayLabel : "Choose a date"}</Text>
          <DateTimePicker
            key={pickerKey}
            style={styles.chipHit}
            value={shown}
            mode="date"
            display="compact"
            accentColor={colors.forest}
            themeVariant="light"
            timeZoneName={HALL_ZONE}
            onValueChange={(_event, date) => {
              if (!date || (value !== null && hallDate(date) === hallDate(value))) {
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
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.navigate("/permissions");
  }, [navigation]);
}

function dateOnHall(value: string): Date {
  return new Date(`${value}T12:00:00+05:30`);
}

function relationFields(relation: string): { id: string; other: string } {
  if (relation !== OTHER_RELATION && RELATIONS.includes(relation)) {
    return { id: relation, other: "" };
  }
  return { id: OTHER_RELATION, other: relation };
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
  const startDate = start ? hallDate(start) : "";
  const endDate = end ? hallDate(end) : "";
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
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Guest stay</Text>
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
              const shown = current ?? new Date();
              if (hallDate(shown) >= hallDate(date)) {
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
          <Text style={[text.error, { color: colors.danger }]}>Leaves has to be on or after Arrives</Text>
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
      {error ? (
        <Text selectable style={[text.error, { color: colors.danger }]}>
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

function GuestDetail({ id }: { id: string }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadGuestStay, cancelGuestStay } = useSession();
  const back = useLeave();
  const [stay, setStay] = useState<GuestStay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const alertAt = useRef(0);

  const load = useCallback(() => {
    let active = true;
    void loadGuestStay(id).then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setStay(result.stay);
    });
    return () => {
      active = false;
    };
  }, [id, loadGuestStay]);

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
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
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
        <Text selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function GuestScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = paramText(params.id);
  if (id.length > 0) {
    return <GuestDetail id={id} />;
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
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  title: { textAlign: "left" },
  block: { gap: 16 },
  dateField: { gap: 8 },
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
