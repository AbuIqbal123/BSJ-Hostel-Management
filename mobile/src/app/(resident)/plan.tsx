import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams, useNavigation } from "expo-router";
import {
  Alert,
  BackHandler,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { utcInstant } from "@/format-when";
import { OTHER_NAME, WhenField, leaveNote, notBefore, returnNote } from "@/outing-when";
import { lockOuting, noteOutingLeft, useSession, type DestinationItem } from "@/session";
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
  const navigation = useNavigation();
  const pending = useRef(false);
  const holdSave = useRef(0);
  const leaving = useRef(false);
  const alertAt = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeded = useRef<string | null>(null);

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
    if (!editing || !places || seeded.current === outingId) {
      return;
    }
    seeded.current = outingId;
    const place = paramText(params.place);
    const named = places.find((item) => item.name === place && item.name !== OTHER_NAME) ?? null;
    const otherPlace = places.find((item) => item.name === OTHER_NAME) ?? null;
    if (named) {
      setDestinationId(named.id);
      setWhere("");
    } else if (otherPlace && place.length > 0) {
      setDestinationId(otherPlace.id);
      setWhere(place);
    } else {
      setDestinationId(null);
      setWhere("");
    }
    setLeaveAt(instant(paramText(params.startsAt)));
    setBackBy(instant(paramText(params.expectedReturnAt)));
    setError(null);
  }, [editing, outingId, params.expectedReturnAt, params.place, params.startsAt, places]);

  const chosen = places?.find((item) => item.id === destinationId) ?? null;
  const other = chosen?.name === OTHER_NAME;
  const leaveProblem = leaveNote(leaveAt);
  const returnProblem = returnNote(leaveAt, backBy);

  const backHome = useCallback(() => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    goBackOr(navigation, "/home");
  }, [navigation]);

  // The alert is still closing when a fast cancel returns. Navigating then
  // drops the pop, so Home replaces itself instead of sliding back.
  const leaveWhenStill = useCallback(() => {
    const wait = Math.max(0, 250 - (Date.now() - alertAt.current));
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
    leaveTimer.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(backHome);
    }, wait);
  }, [backHome]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const holdPlan = useCallback(() => {
    holdSave.current = Date.now() + 700;
  }, []);

  const submit = useCallback(async () => {
    if (Date.now() < holdSave.current || pending.current) {
      return;
    }
    if (!destinationId) {
      setError("Choose a place");
      return;
    }
    if (!leaveAt) {
      setError("Choose when you will leave");
      return;
    }
    if (!backBy) {
      setError("Choose when you will be back");
      return;
    }
    if (leaveNote(leaveAt) || returnNote(leaveAt, backBy)) {
      setError(null);
      return;
    }
    const placeText = where.trim();
    if (other && placeText.length === 0) {
      setError("Say where");
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
    leaveWhenStill();
  }, [
    backBy,
    destinationId,
    leaveAt,
    other,
    outingId,
    leaveWhenStill,
    updateOuting,
    where,
  ]);

  const confirmCancel = useCallback(async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    const failure = await cancelOuting(outingId);
    pending.current = false;
    if (!failure) {
      noteOutingLeft(outingId);
      leaveWhenStill();
      return;
    }
    if (failure.code === "outing_window_open" || failure.code === "already_outside") {
      lockOuting(outingId);
      setError(null);
      leaveWhenStill();
      return;
    }
    setError(failure.message);
  }, [cancelOuting, leaveWhenStill, outingId]);

  const cancel = useCallback(() => {
    if (pending.current) {
      return;
    }
    Alert.alert("Cancel outing", undefined, [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel outing",
        style: "destructive",
        onPress: () => {
          alertAt.current = Date.now();
          void confirmCancel();
        },
      },
    ]);
  }, [confirmCancel]);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={backHome}
        style={styles.back}
      >
        <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
      </Pressable>
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
      {places ? (
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
                setError(null);
              }}
              colors={colors}
              note={null}
            />
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
          </View>
          <View style={styles.action}>
            <HallButton
              label="Save"
              onPress={() => {
                setTimeout(() => {
                  void submit();
                }, 50);
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel outing"
              onPress={cancel}
            >
              <Text style={[text.button, { color: colors.danger }]}>Cancel outing</Text>
            </Pressable>
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
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  block: { gap: 28 },
  fields: { gap: 16 },
  action: { gap: 16 },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
});
