import { useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const READY = "Your account is ready. Sign in with your enrolment number and password.";
const PHONE = /^\+[1-9][0-9]{7,14}$/;
const STEP_MS = 220;

type RoomOption = {
  id: string;
  label: string;
};

type BlockOption = {
  id: string;
  name: string;
  rooms: RoomOption[];
};

const LOCAL_HALL = "http://127.0.0.1:8000";
const EMPTY_ROOMS = "No rooms are open.";
const HALL_UNREACHABLE = "The hall could not be reached.";

function explicitHall(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) {
    return null;
  }
  return configured.replace(/\/$/, "");
}

function devMachineHall(): string | null {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:8000`;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return null;
}

let resolvedHall: string | null = null;

async function hallFetch(path: string, init: RequestInit): Promise<Response> {
  const explicit = explicitHall();
  if (explicit) {
    return fetch(`${explicit}${path}`, init);
  }
  if (resolvedHall) {
    return fetch(`${resolvedHall}${path}`, init);
  }
  try {
    const response = await fetch(`${LOCAL_HALL}${path}`, init);
    resolvedHall = LOCAL_HALL;
    return response;
  } catch {
    const fallback = devMachineHall();
    if (!fallback) {
      throw new Error(HALL_UNREACHABLE);
    }
    const response = await fetch(`${fallback}${path}`, init);
    resolvedHall = fallback;
    return response;
  }
}

async function apiMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string" && body.error.message.length > 0) {
      return body.error.message;
    }
  } catch {
    // The hall answered without a message.
  }
  return HALL_UNREACHABLE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptions(value: unknown): BlockOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const blocks: BlockOption[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      typeof item.name !== "string" ||
      item.name.length === 0 ||
      !Array.isArray(item.rooms)
    ) {
      return null;
    }
    const rooms: RoomOption[] = [];
    for (const room of item.rooms) {
      if (
        !isRecord(room) ||
        typeof room.id !== "string" ||
        room.id.length === 0 ||
        typeof room.label !== "string" ||
        room.label.length === 0
      ) {
        return null;
      }
      rooms.push({ id: room.id, label: room.label });
    }
    if (rooms.length === 0) {
      return null;
    }
    blocks.push({ id: item.id, name: item.name, rooms });
  }
  return blocks;
}

function trimmedLength(value: string): number {
  return value.trim().length;
}

function personError(value: string, empty: string): string | null {
  const length = trimmedLength(value);
  if (length < 1) {
    return empty;
  }
  if (length > 120) {
    return "Use 120 characters or fewer.";
  }
  return null;
}

function enrolmentError(value: string): string | null {
  const length = trimmedLength(value);
  if (length < 1) {
    return "Enter your enrolment number.";
  }
  if (length > 40) {
    return "Use 40 characters or fewer.";
  }
  return null;
}

function passwordError(value: string): string | null {
  if (value.length < 10) {
    return "Use at least 10 characters.";
  }
  if (value.length > 200) {
    return "Use 200 characters or fewer.";
  }
  return null;
}

function phoneError(value: string): string | null {
  if (!PHONE.test(value.trim())) {
    return "Enter the phone number with the country code.";
  }
  return null;
}

function courseError(value: string): string | null {
  if (value.trim().length > 120) {
    return "Use 120 characters or fewer.";
  }
  return null;
}

export default function OnboardScreen() {
  const colors = useHallColors();
  const { onboard } = useSession();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [enrolment, setEnrolment] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [course, setCourse] = useState("");
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [listNote, setListNote] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));
  const moving = useRef(false);
  const pending = useRef(false);

  const block = blocks.find((item) => item.id === blockId) ?? null;
  const room = block?.rooms.find((item) => item.id === roomId) ?? null;
  const rooms = block?.rooms ?? [];

  useEffect(() => {
    let active = true;
    hallFetch("/api/v1/auth/onboard/options", { method: "GET" })
      .then(async (response) => {
        if (!active) {
          return;
        }
        if (!response.ok) {
          const message = await apiMessage(response);
          if (!active) {
            return;
          }
          setBlocks([]);
          setListNote(message);
          return;
        }
        const parsed = readOptions((await response.json()) as unknown);
        if (!active) {
          return;
        }
        if (!parsed) {
          setBlocks([]);
          setListNote(HALL_UNREACHABLE);
          return;
        }
        setBlocks(parsed);
        setListNote(parsed.length === 0 ? EMPTY_ROOMS : null);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setBlocks([]);
        setListNote(HALL_UNREACHABLE);
      });
    return () => {
      active = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showStep = useCallback(
    (next: number) => {
      if (moving.current || next === step) {
        return;
      }
      moving.current = true;
      Animated.timing(opacity, {
        toValue: 0,
        duration: STEP_MS / 2,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          moving.current = false;
          return;
        }
        setStep(next);
        setError(null);
        Animated.timing(opacity, {
          toValue: 1,
          duration: STEP_MS / 2,
          useNativeDriver: true,
        }).start(() => {
          moving.current = false;
        });
      });
    },
    [opacity, step],
  );

  const chooseBlock = useCallback((id: string) => {
    setBlockId(id);
    setRoomId(null);
    setError(null);
  }, []);

  const chooseRoom = useCallback((id: string) => {
    setRoomId(id);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    const selectedBlock = blocks.find((item) => item.id === blockId) ?? null;
    const selectedRoom = selectedBlock?.rooms.find((item) => item.id === roomId) ?? null;
    if (pending.current || !selectedBlock || !selectedRoom) {
      return;
    }
    const problem =
      personError(fullName, "Enter your full name.") ??
      enrolmentError(enrolment) ??
      passwordError(password) ??
      phoneError(phone) ??
      personError(guardianName, "Enter the guardian name.") ??
      phoneError(guardianPhone) ??
      courseError(course);
    if (problem) {
      setError(problem);
      return;
    }
    pending.current = true;
    const message = await onboard({
      full_name: fullName,
      enrolment_number: enrolment,
      password,
      phone,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      course,
      block_id: selectedBlock.id,
      room_id: selectedRoom.id,
    });
    pending.current = false;
    if (message) {
      setError(message);
      return;
    }
    setReady(true);
  }, [
    blockId,
    blocks,
    course,
    enrolment,
    fullName,
    guardianName,
    guardianPhone,
    onboard,
    password,
    phone,
    roomId,
  ]);

  const advance = useCallback(() => {
    if (step === 0) {
      const problem =
        personError(fullName, "Enter your full name.") ??
        enrolmentError(enrolment) ??
        passwordError(password);
      if (problem) {
        setError(problem);
        return;
      }
      showStep(1);
      return;
    }
    if (step === 1) {
      const problem =
        phoneError(phone) ??
        personError(guardianName, "Enter the guardian name.") ??
        phoneError(guardianPhone);
      if (problem) {
        setError(problem);
        return;
      }
      showStep(2);
    }
  }, [enrolment, fullName, guardianName, guardianPhone, password, phone, showStep, step]);

  if (ready) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.paper }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text selectable style={[text.body, { color: colors.ink }]}>
          {READY}
        </Text>
        <HallButton label="Sign in" onPress={() => router.replace("/sign-in")} />
      </ScrollView>
    );
  }

  const canSubmit = block !== null && room !== null;
  const action = step < 2 ? "Continue" : "Onboard";

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.fields, { opacity }]}>
        {step === 0 ? (
          <>
            <TextField
              label="Full name"
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                clearError();
              }}
              autoCapitalize="sentences"
              autoComplete="off"
              returnKeyType="next"
            />
            <TextField
              label="Enrolment number"
              value={enrolment}
              onChangeText={(value) => {
                setEnrolment(value);
                clearError();
              }}
              autoComplete="off"
              returnKeyType="next"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearError();
              }}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={advance}
            />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <TextField
              label="Phone"
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                clearError();
              }}
              autoComplete="off"
              returnKeyType="next"
            />
            <TextField
              label="Guardian name"
              value={guardianName}
              onChangeText={(value) => {
                setGuardianName(value);
                clearError();
              }}
              autoCapitalize="sentences"
              autoComplete="off"
              returnKeyType="next"
            />
            <TextField
              label="Guardian phone"
              value={guardianPhone}
              onChangeText={(value) => {
                setGuardianPhone(value);
                clearError();
              }}
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={advance}
            />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <View style={styles.choice}>
              <Text style={[text.label, { color: colors.inkSoft }]}>Block</Text>
              {blocks.map((item) => {
                const selected = item.id === blockId;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected }}
                    onPress={() => chooseBlock(item.id)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selected ? colors.forest : colors.line,
                      },
                    ]}
                  >
                    <Text style={[text.field, { color: selected ? colors.forest : colors.ink }]}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.choice}>
              <Text style={[text.label, { color: colors.inkSoft }]}>Room</Text>
              {rooms.map((item) => {
                const selected = item.id === roomId;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    onPress={() => chooseRoom(item.id)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selected ? colors.forest : colors.line,
                      },
                    ]}
                  >
                    <Text style={[text.field, { color: selected ? colors.forest : colors.ink }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {listNote ? (
              <Text style={[text.body, { color: colors.inkSoft }]}>{listNote}</Text>
            ) : null}
            <TextField
              label="Course"
              value={course}
              onChangeText={(value) => {
                setCourse(value);
                clearError();
              }}
              autoCapitalize="sentences"
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={() => {
                void submit();
              }}
            />
          </>
        ) : null}
        <View>
          <HallButton
            label={action}
            disabled={step === 2 && !canSubmit}
            onPress={() => {
              if (step < 2) {
                advance();
                return;
              }
              void submit();
            }}
          />
          <View
            pointerEvents="none"
            accessibilityElementsHidden={error === null}
            style={styles.errorSlot}
          >
            <Text
              selectable={error !== null}
              style={[
                text.error,
                styles.error,
                {
                  color: colors.danger,
                  backgroundColor: colors.dangerBg,
                  opacity: error ? 1 : 0,
                },
              ]}
            >
              {error ?? " "}
            </Text>
          </View>
        </View>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => showStep(step - 1)}
            style={styles.back}
          >
            <Text style={[text.body, { color: colors.forest }]}>Back</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 28,
  },
  fields: { gap: 16 },
  choice: { gap: 8 },
  option: {
    minHeight: 52,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 14,
  },
  errorSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 12,
  },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
  back: {
    alignItems: "center",
    marginTop: 64,
  },
});
