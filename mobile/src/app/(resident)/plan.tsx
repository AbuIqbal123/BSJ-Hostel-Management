import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceField } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { useSession, type DestinationItem } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Seeded catalog name. backend/app/shared/migrations/0001_create_hall.sql stores 'Other'.
const OTHER_NAME = "Other";

const backByFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatBackBy(date: Date): string {
  return backByFormat.format(date);
}

function BackByField({
  value,
  onChange,
}: {
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
      <Text style={[text.label, { color: colors.inkSoft }]}>Back by</Text>
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
          accessibilityLabel={value ? `Back by, ${formatBackBy(value)}` : "Back by"}
          onPress={open}
          style={[
            styles.shell,
            styles.shellPad,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Text style={[text.field, { color: value ? colors.ink : colors.inkFaint }]}>
            {value ? formatBackBy(value) : "Back by"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PlanScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadResidentHome, loadDestinations, planOuting } = useSession();
  const [gate, setGate] = useState<"loading" | "in" | "out">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [places, setPlaces] = useState<DestinationItem[] | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [backBy, setBackBy] = useState<Date | null>(null);
  const [where, setWhere] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);
  const pending = useRef(false);

  useFocusEffect(
    useCallback(() => {
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
        setGate(result.home.out ? "out" : "in");
      });
      return () => {
        active = false;
      };
    }, [loadResidentHome]),
  );

  useEffect(() => {
    if (gate !== "in" || places) {
      return;
    }
    let active = true;
    void loadDestinations().then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setLoadError(result.error);
        setGate("loading");
        return;
      }
      setPlaces(result.items);
    });
    return () => {
      active = false;
    };
  }, [gate, loadDestinations, places]);

  const clearResult = useCallback(() => {
    setError(null);
    setPlanned(false);
  }, []);

  const chosen = places?.find((item) => item.id === destinationId) ?? null;
  const other = chosen?.name === OTHER_NAME;

  const submit = useCallback(async () => {
    if (pending.current) {
      return;
    }
    if (!destinationId) {
      setPlanned(false);
      setError("Choose a place.");
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
    const message = await planOuting({
      destination_id: destinationId,
      expected_return_at: backBy.toISOString(),
      ...(other ? { destination_text: placeText } : {}),
    });
    pending.current = false;
    if (message) {
      setPlanned(false);
      setError(message);
      return;
    }
    setDestinationId(null);
    setBackBy(null);
    setWhere("");
    setError(null);
    setPlanned(true);
  }, [backBy, destinationId, other, planOuting, where]);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {gate === "out" ? (
        <Text style={[text.body, { color: colors.ink }]}>You are out.</Text>
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
      {gate === "in" && places ? (
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
            <BackByField
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
              label="Plan"
              onPress={() => {
                void submit();
              }}
            />
            {planned ? (
              <Text style={[text.body, { color: colors.ink }]}>Outing planned.</Text>
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
