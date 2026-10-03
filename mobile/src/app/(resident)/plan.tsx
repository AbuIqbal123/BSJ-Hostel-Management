import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { formatWhen, utcInstant } from "@/format-when";
import { lockOuting, useSession, type DestinationItem } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Seeded catalog name. backend/app/shared/migrations/0001_create_hall.sql stores 'Other'.
export const OTHER_NAME = "Other";

// hall_day() is the calendar date in hall_settings.timezone, seeded Asia/Kolkata.
// Ordinary hours are the seeded summer and winter outing clocks. The start is
// not included. The end is included. A later time is not a permission flow.
const HALL_ZONE = "Asia/Kolkata";
const SUMMER_START = "04-01";
const WINTER_START = "10-01";
const DAY_START = "06:30";
const SUMMER_END = "18:30";
const WINTER_END = "17:30";

const START_FUTURE = "The outing start must be in the future.";
const RETURN_FUTURE = "The expected return must be in the future.";
const RETURN_AFTER = "The expected return must be after the start.";
const SAME_DAY = "An ordinary outing starts and returns on the same hall day.";
const START_EARLY = "That start is outside ordinary hours.";
const START_LATE = "That start is outside ordinary hours. Please submit a permission request.";
const RETURN_EARLY = "That return is outside ordinary hours.";
const RETURN_LATE = "That return is outside ordinary hours. Please submit a permission request.";

function paramText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function instant(value: string): Date | null {
  if (value.length === 0) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function hallPart(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALL_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function hallDay(date: Date): string {
  return `${hallPart(date, "year")}-${hallPart(date, "month")}-${hallPart(date, "day")}`;
}

function hallClock(date: Date): string {
  return `${hallPart(date, "hour")}:${hallPart(date, "minute")}:${hallPart(date, "second")}`;
}

function monthDay(date: Date): string {
  return `${hallPart(date, "month")}-${hallPart(date, "day")}`;
}

function hoursNote(date: Date, kind: "start" | "return"): string | null {
  const day = monthDay(date);
  const summer = SUMMER_START <= day && day < WINTER_START;
  const end = summer ? SUMMER_END : WINTER_END;
  const clock = hallClock(date);
  if (clock <= `${DAY_START}:00`) {
    return kind === "start" ? START_EARLY : RETURN_EARLY;
  }
  if (clock > `${end}:00`) {
    return kind === "start" ? START_LATE : RETURN_LATE;
  }
  return null;
}

export function leaveNote(leaveAt: Date | null): string | null {
  if (!leaveAt) {
    return null;
  }
  if (leaveAt.getTime() <= Date.now()) {
    return START_FUTURE;
  }
  return hoursNote(leaveAt, "start");
}

export function returnNote(leaveAt: Date | null, backBy: Date | null): string | null {
  if (!backBy) {
    return null;
  }
  if (backBy.getTime() <= Date.now()) {
    return RETURN_FUTURE;
  }
  if (leaveAt && backBy.getTime() <= leaveAt.getTime()) {
    return RETURN_AFTER;
  }
  if (leaveAt && hallDay(leaveAt) !== hallDay(backBy)) {
    return SAME_DAY;
  }
  return hoursNote(backBy, "return");
}

export function WhenField({
  label,
  value,
  onChange,
  pastNote,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  pastNote: string | null;
}) {
  const colors = useHallColors();
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    if (value === null) {
      setIosOpen(false);
    }
  }, [value]);

  const open = () => {
    if (Platform.OS === "android") {
      const seed = value ?? new Date();
      DateTimePickerAndroid.open({
        value: seed,
        mode: "date",
        onValueChange: (_event, date) => {
          if (!date) {
            return;
          }
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            onValueChange: (_timeEvent, time) => {
              if (!time) {
                return;
              }
              const next = new Date(date);
              next.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(next);
            },
          });
        },
      });
      return;
    }
    if (!value) {
      onChange(new Date());
    }
    setIosOpen(true);
  };

  const showPicker = Platform.OS !== "android" && iosOpen;

  return (
    <View style={styles.field}>
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      {showPicker ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="datetime"
          display="compact"
          onValueChange={(_event, date) => {
            if (date) {
              onChange(date);
            }
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}, ${formatWhen(utcInstant(value))}` : label}
          onPress={open}
          style={[
            styles.shell,
            styles.shellPad,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Text style={[text.field, { color: value ? colors.ink : colors.inkFaint }]}>
            {value ? formatWhen(utcInstant(value)) : label}
          </Text>
        </Pressable>
      )}
      {pastNote ? <Text style={[text.error, { color: colors.danger }]}>{pastNote}</Text> : null}
    </View>
  );
}

export default function PlanScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    outing?: string | string[];
    place?: string | string[];
    startsAt?: string | string[];
    expectedReturnAt?: string | string[];
  }>();
  const outingId = paramText(params.outing);
  const editing = outingId.length > 0;
  const { loadDestinations, planOuting, updateOuting, cancelOuting } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [places, setPlaces] = useState<DestinationItem[] | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [leaveAt, setLeaveAt] = useState<Date | null>(null);
  const [backBy, setBackBy] = useState<Date | null>(null);
  const [where, setWhere] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);
  const pending = useRef(false);
  const seeded = useRef<string | null>(null);
  const seenOuting = useRef<string>("");

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => dismissOpenChoice());
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (places || !editing) {
      return;
    }
    let active = true;
    void loadDestinations().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setPlaces(result.items);
    });
    return () => {
      active = false;
    };
  }, [editing, loadDestinations, places]);

  useEffect(() => {
    if (seenOuting.current === outingId) {
      return;
    }
    if (seenOuting.current.length > 0 && outingId.length === 0) {
      setDestinationId(null);
      setLeaveAt(null);
      setBackBy(null);
      setWhere("");
      setError(null);
      setPlanned(false);
      seeded.current = null;
    }
    seenOuting.current = outingId;
  }, [outingId]);

  useEffect(() => {
    if (!editing || !places || seeded.current === outingId) {
      return;
    }
    seeded.current = outingId;
    const place = paramText(params.place);
    const match = places.find((item) => item.name === place) ?? null;
    if (match) {
      setDestinationId(match.id);
      setWhere(match.name === OTHER_NAME ? place : "");
    } else {
      setDestinationId(null);
      setWhere("");
    }
    setLeaveAt(instant(paramText(params.startsAt)));
    setBackBy(instant(paramText(params.expectedReturnAt)));
    setError(null);
    setPlanned(false);
  }, [editing, outingId, params.expectedReturnAt, params.place, params.startsAt, places]);

  const clearResult = useCallback(() => {
    setError(null);
    setPlanned(false);
  }, []);

  const chosen = places?.find((item) => item.id === destinationId) ?? null;
  const other = chosen?.name === OTHER_NAME;
  const leaveProblem = leaveNote(leaveAt);
  const returnProblem = returnNote(leaveAt, backBy);

  const backHome = useCallback(() => {
    router.setParams({ outing: "", place: "", startsAt: "", expectedReturnAt: "" });
    router.navigate("/home");
  }, []);

  const submit = useCallback(async () => {
    if (pending.current) {
      return;
    }
    if (!destinationId) {
      setPlanned(false);
      setError("Choose a place.");
      return;
    }
    if (!leaveAt) {
      setPlanned(false);
      setError("Choose when you will leave.");
      return;
    }
    if (!backBy) {
      setPlanned(false);
      setError("Choose when you will be back.");
      return;
    }
    if (leaveNote(leaveAt) || returnNote(leaveAt, backBy)) {
      setPlanned(false);
      setError(null);
      return;
    }
    const placeText = where.trim();
    if (other && placeText.length === 0) {
      setPlanned(false);
      setError("Say where.");
      return;
    }
    pending.current = true;
    const startsAt = utcInstant(leaveAt);
    const expectedReturnAt = utcInstant(backBy);
    const message = editing
      ? await updateOuting(outingId, {
          destination_id: destinationId,
          starts_at: startsAt,
          expected_return_at: expectedReturnAt,
          ...(other ? { destination_text: placeText } : {}),
        })
      : await planOuting({
          destination_id: destinationId,
          starts_at: startsAt,
          expected_return_at: expectedReturnAt,
          ...(other ? { destination_text: placeText } : {}),
        });
    pending.current = false;
    if (message) {
      setPlanned(false);
      setError(message);
      return;
    }
    if (editing) {
      backHome();
      return;
    }
    setDestinationId(null);
    setLeaveAt(null);
    setBackBy(null);
    setWhere("");
    setError(null);
    setPlanned(true);
  }, [
    backBy,
    backHome,
    destinationId,
    editing,
    leaveAt,
    other,
    outingId,
    planOuting,
    updateOuting,
    where,
  ]);

  const confirmCancel = useCallback(async () => {
    if (pending.current || !editing) {
      return;
    }
    pending.current = true;
    const failure = await cancelOuting(outingId);
    pending.current = false;
    if (!failure) {
      backHome();
      return;
    }
    if (failure.code === "outing_window_open" || failure.code === "already_outside") {
      lockOuting(outingId);
      setError(null);
      backHome();
      return;
    }
    setPlanned(false);
    setError(failure.message);
  }, [backHome, cancelOuting, editing, outingId]);

  const cancel = useCallback(() => {
    if (pending.current || !editing) {
      return;
    }
    Alert.alert("Cancel outing", undefined, [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel outing",
        onPress: () => {
          void confirmCancel();
        },
      },
    ]);
  }, [confirmCancel, editing]);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };
  const showForm = editing && places !== null;

  if (!editing) {
    return <Redirect href="/home" />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.dismiss} onPress={dismissOpenChoice}>
      {loadError ? (
        <Text
          selectable
          style={[
            text.error,
            styles.error,
            { color: colors.danger, backgroundColor: colors.dangerBg },
          ]}
        >
          {loadError}
        </Text>
      ) : null}
      {showForm && places ? (
        <View style={styles.block}>
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
                clearResult();
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
                clearResult();
              }}
            />
            <WhenField
              label="Back by"
              value={backBy}
              pastNote={returnProblem}
              onChange={(date) => {
                setBackBy(date);
                clearResult();
              }}
            />
            {other ? (
              <TextField
                label="Where"
                value={where}
                onChangeText={(value) => {
                  setWhere(value);
                  clearResult();
                }}
                autoCapitalize="sentences"
                autoComplete="off"
                returnKeyType="go"
                onSubmitEditing={() => {
                  void submit();
                }}
              />
            ) : null}
          </View>
          <View style={styles.action}>
            <HallButton
              label="Save"
              onPress={() => {
                void submit();
              }}
            />
            {!editing && planned ? (
              <Text style={[text.body, { color: colors.ink }]}>Outing planned.</Text>
            ) : null}
            {editing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel outing"
                onPress={cancel}
              >
                <Text style={[text.body, { color: colors.inkSoft }]}>Cancel outing</Text>
              </Pressable>
            ) : null}
            {error ? (
              <Text
                selectable
                style={[
                  text.error,
                  styles.error,
                  { color: colors.danger, backgroundColor: colors.dangerBg },
                ]}
              >
                {error}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 16,
  },
  dismiss: { flexGrow: 1, gap: 16 },
  block: { gap: 28 },
  fields: { gap: 16 },
  field: { gap: 8 },
  action: { gap: 16 },
  shell: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    justifyContent: "center",
  },
  shellPad: { paddingHorizontal: 14 },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
});
