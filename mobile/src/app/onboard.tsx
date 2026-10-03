import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { hallFetch, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PHONE = /^\+[1-9][0-9]{7,14}$/;
const STEP_MS = 220;
const TRAVEL = 28;
const STEPS = ["Person", "Contact", "Room"] as const;

const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "Use at least 10 characters.", test: (value) => value.length >= 10 },
  {
    label: "Include an uppercase letter, a lowercase letter, a number, and a symbol.",
    test: (value) =>
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[^A-Za-z0-9]/.test(value),
  },
];

type RoomOption = {
  id: string;
  label: string;
};

type BlockOption = {
  id: string;
  name: string;
  rooms: RoomOption[];
};

const EMPTY_ROOMS = "No rooms are open.";
const HALL_UNREACHABLE = "The hall could not be reached.";
const PHONE_LINE = "Use an Indian mobile: +91 and exactly 10 digits.";

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

function openingBlockId(options: BlockOption[]): string | null {
  const opening = options.find((item) => {
    const name = item.name.trim().toLowerCase();
    return name === "b" || name === "block b";
  });
  return opening?.id ?? null;
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

function passwordRulesMet(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

function dialDigits(value: string): string {
  return value.replace(/\s/g, "");
}

function e164(value: string): string {
  return `+91${dialDigits(value)}`;
}

function phoneError(value: string): string | null {
  const digits = dialDigits(value);
  if (!/^\d{10}$/.test(digits) || !PHONE.test(e164(value))) {
    return PHONE_LINE;
  }
  return null;
}

function courseError(value: string): string | null {
  if (value.trim().length > 120) {
    return "Use 120 characters or fewer.";
  }
  return null;
}


function phoneColor(
  value: string,
  colors: { forest: string; danger: string; inkSoft: string },
  noted: boolean,
): string {
  if (phoneError(value) === null) {
    return colors.forest;
  }
  return noted ? colors.danger : colors.inkSoft;
}

function dialCode(ink: string) {
  return (
    <View style={styles.dial}>
      <Text style={styles.flag} accessible={false}>
        🇮🇳
      </Text>
      <Text style={[text.field, { color: ink }]}>+91</Text>
    </View>
  );
}

export default function OnboardScreen() {
  const colors = useHallColors();
  const { onboard } = useSession();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordNoted, setPasswordNoted] = useState(false);
  const [phoneNoted, setPhoneNoted] = useState(false);
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
  const [roomQuery, setRoomQuery] = useState("");
  const opacity = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const moving = useRef(false);
  const pending = useRef(false);

  const block = blocks.find((item) => item.id === blockId) ?? null;
  const room = block?.rooms.find((item) => item.id === roomId) ?? null;
  const rooms = block?.rooms ?? [];
  const roomNeedle = roomQuery.trim().toLowerCase();
  const roomMatches =
    roomNeedle.length === 0
      ? []
      : rooms.filter((item) => item.label.toLowerCase().includes(roomNeedle));

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
        setBlockId((current) => current ?? openingBlockId(parsed));
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
      if (moving.current || next === step || next < 0 || next > 2) {
        return;
      }
      moving.current = true;
      const forward = next > step;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: STEP_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(shift, {
          toValue: forward ? -TRAVEL : TRAVEL,
          duration: STEP_MS / 2,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          moving.current = false;
          return;
        }
        shift.setValue(forward ? TRAVEL : -TRAVEL);
        opacity.setValue(0.4);
        setStep(next);
        setError(null);
        requestAnimationFrame(() => {
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: STEP_MS / 2,
              useNativeDriver: true,
            }),
            Animated.timing(shift, {
              toValue: 0,
              duration: STEP_MS / 2,
              useNativeDriver: true,
            }),
          ]).start(() => {
            moving.current = false;
          });
        });
      });
    },
    [opacity, shift, step],
  );

  const chooseBlock = useCallback(
    (id: string) => {
      if (id !== blockId) {
        setBlockId(id);
        setRoomId(null);
        setRoomQuery("");
      }
      setError(null);
    },
    [blockId],
  );

  const chooseRoom = useCallback((id: string) => {
    setRoomId(id);
    setError(null);
  }, []);

  const onRoomQuery = useCallback(
    (value: string) => {
      setRoomQuery(value);
      setError(null);
      const needle = value.trim().toLowerCase();
      setRoomId((current) => {
        if (!current) {
          return null;
        }
        const selected = rooms.find((item) => item.id === current);
        if (!selected) {
          return null;
        }
        if (needle.length === 0 || !selected.label.toLowerCase().includes(needle)) {
          return null;
        }
        return current;
      });
    },
    [rooms],
  );

  const submit = useCallback(async () => {
    const selectedBlock = blocks.find((item) => item.id === blockId) ?? null;
    const selectedRoom = selectedBlock?.rooms.find((item) => item.id === roomId) ?? null;
    if (pending.current || !selectedBlock || !selectedRoom) {
      return;
    }
    const problem =
      personError(fullName, "Enter your full name.") ??
      enrolmentError(enrolment) ??
      (password.length > 200 ? "Use 200 characters or fewer." : null) ??
      phoneError(phone) ??
      personError(guardianName, "Enter the guardian name.") ??
      phoneError(guardianPhone) ??
      courseError(course);
    if (problem) {
      setError(problem);
      return;
    }
    if (!passwordRulesMet(password)) {
      setPasswordNoted(true);
      setError(null);
      return;
    }
    pending.current = true;
    const message = await onboard({
      full_name: fullName,
      enrolment_number: enrolment,
      password,
      phone: e164(phone),
      guardian_name: guardianName,
      guardian_phone: e164(guardianPhone),
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
        (password.length > 200 ? "Use 200 characters or fewer." : null);
      if (problem) {
        setError(problem);
        return;
      }
      if (!passwordRulesMet(password)) {
        setPasswordNoted(true);
        setError(null);
        return;
      }
      showStep(1);
      return;
    }
    if (step === 1) {
      const nameProblem = personError(guardianName, "Enter the guardian name.");
      const phoneBad = phoneError(phone) !== null || phoneError(guardianPhone) !== null;
      if (phoneBad) {
        setPhoneNoted(true);
      }
      if (nameProblem) {
        setError(nameProblem);
        return;
      }
      if (phoneBad) {
        setError(null);
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
        <View style={styles.ready}>
          <Text selectable style={[text.body, { color: colors.ink }]}>
            Account created.
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Sign in"
            onPress={() => router.replace("/sign-in")}
            style={styles.signIn}
          >
            <Text style={[text.body, { color: colors.forest }]}>Sign in</Text>
          </Pressable>
        </View>
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
      <View style={styles.tracker}>
        {STEPS.map((label, index) => {
          const current = index === step;
          const earlier = index < step;
          const color = current ? colors.forest : earlier ? colors.ink : colors.inkFaint;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: current }}
              onPress={() => {
                if (index < step) {
                  showStep(index);
                }
              }}
            >
              <Text style={[text.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Animated.View style={[styles.fields, { opacity, transform: [{ translateX: shift }] }]}>
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
            <View style={styles.passwordBlock}>
              <TextField
                label="Password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setPasswordNoted(false);
                  clearError();
                }}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={advance}
              />
              <View style={styles.rules}>
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  const color = met ? colors.forest : passwordNoted ? colors.danger : colors.inkSoft;
                  return (
                    <Text key={rule.label} style={[text.error, { color }]}>
                      {rule.label}
                    </Text>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <View style={styles.passwordBlock}>
              <TextField
                label="Phone"
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setPhoneNoted(false);
                  clearError();
                }}
                autoComplete="off"
                keyboardType="number-pad"
                prefix={dialCode(colors.ink)}
                returnKeyType="next"
              />
              <Text style={[text.error, { color: phoneColor(phone, colors, phoneNoted) }]}>
                {PHONE_LINE}
              </Text>
            </View>
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
            <View style={styles.passwordBlock}>
              <TextField
                label="Guardian phone"
                value={guardianPhone}
                onChangeText={(value) => {
                  setGuardianPhone(value);
                  setPhoneNoted(false);
                  clearError();
                }}
                autoComplete="off"
                keyboardType="number-pad"
                prefix={dialCode(colors.ink)}
                returnKeyType="go"
                onSubmitEditing={advance}
              />
              <Text style={[text.error, { color: phoneColor(guardianPhone, colors, phoneNoted) }]}>
                {PHONE_LINE}
              </Text>
            </View>
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
            {listNote ? (
              <Text style={[text.body, { color: colors.inkSoft }]}>{listNote}</Text>
            ) : null}
            <TextField
              label="Room"
              value={roomQuery}
              onChangeText={onRoomQuery}
              autoComplete="off"
              returnKeyType="next"
            />
            {roomMatches.length > 0 ? (
              <View style={styles.choice}>
                {roomMatches.map((item) => {
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
  tracker: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
  },
  fields: { gap: 16 },
  passwordBlock: { gap: 8 },
  rules: { gap: 2 },
  dial: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
  },
  flag: { fontSize: 18 },
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
  ready: { gap: 16 },
  signIn: { alignSelf: "flex-start" },
});
