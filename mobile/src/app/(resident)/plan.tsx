import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  BackHandler,
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
import { utcInstant } from "@/format-when";
import { OTHER_NAME, WhenField, leaveNote, returnNote } from "@/outing-when";
import { lockOuting, useSession, type DestinationItem } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

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
  const { loadDestinations, updateOuting, cancelOuting } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [places, setPlaces] = useState<DestinationItem[] | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [leaveAt, setLeaveAt] = useState<Date | null>(null);
  const [backBy, setBackBy] = useState<Date | null>(null);
  const [where, setWhere] = useState("");
  const [error, setError] = useState<string | null>(null);
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
  }, [editing, outingId, params.expectedReturnAt, params.place, params.startsAt, places]);

  const clearResult = useCallback(() => {
    setError(null);
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
    if (pending.current || !editing) {
      return;
    }
    if (!destinationId) {
      setError("Choose a place.");
      return;
    }
    if (!leaveAt) {
      setError("Choose when you will leave.");
      return;
    }
    if (!backBy) {
      setError("Choose when you will be back.");
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
    const message = await updateOuting(outingId, {
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
    backHome();
  }, [
    backBy,
    backHome,
    destinationId,
    editing,
    leaveAt,
    other,
    outingId,
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
  action: { gap: 16 },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
});
