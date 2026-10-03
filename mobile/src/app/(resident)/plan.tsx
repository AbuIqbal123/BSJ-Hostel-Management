import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceField } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { formatWhen, utcInstant } from "@/format-when";
import { useSession, type DestinationItem } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Seeded catalog name. backend/app/shared/migrations/0001_create_hall.sql stores 'Other'.
const OTHER_NAME = "Other";

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

function WhenField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
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
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            onValueChange: (_timeEvent, time) => {
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
          onValueChange={(_event, date) => onChange(date)}
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
  const { loadResidentHome, loadDestinations, planOuting, updateOuting, cancelOuting } = useSession();
  const [gate, setGate] = useState<"loading" | "in" | "out" | "window">("loading");
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

  useFocusEffect(
    useCallback(() => {
      if (editing) {
        return;
      }
      let active = true;
      void loadResidentHome().then((result) => {
        if (!active) {
          return;
        }
        if (result.error !== null) {
          setLoadError(result.error);
          setGate("loading");
          return;
        }
        setLoadError(null);
        if (result.home.out) {
          setGate("out");
        } else if (result.home.windowOpen) {
          setGate("window");
        } else {
          setGate("in");
        }
      });
      return () => {
        active = false;
      };
    }, [editing, loadResidentHome]),
  );

  useEffect(() => {
    if (places) {
      return;
    }
    if (!editing && gate !== "in") {
      return;
    }
    let active = true;
    void loadDestinations().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setLoadError(result.error);
        if (!editing) {
          setGate("loading");
        }
        return;
      }
      setPlaces(result.items);
    });
    return () => {
      active = false;
    };
  }, [editing, gate, loadDestinations, places]);

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

  const cancel = useCallback(async () => {
    if (pending.current || !editing) {
      return;
    }
    pending.current = true;
    const message = await cancelOuting(outingId);
    pending.current = false;
    if (message) {
      setPlanned(false);
      setError(message);
      return;
    }
    backHome();
  }, [backHome, cancelOuting, editing, outingId]);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };
  const showForm = places !== null && (editing || gate === "in");

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {!editing && gate === "out" ? (
        <Text style={[text.body, { color: colors.ink }]}>You are out.</Text>
      ) : null}
      {!editing && gate === "window" ? (
        <Text style={[text.body, { color: colors.ink }]}>
          You cannot start another outing while one is inside its window.
        </Text>
      ) : null}
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
              onChange={(date) => {
                setLeaveAt(date);
                clearResult();
              }}
            />
            <WhenField
              label="Back by"
              value={backBy}
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
              label={editing ? "Save" : "Plan"}
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
                onPress={() => {
                  void cancel();
                }}
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
