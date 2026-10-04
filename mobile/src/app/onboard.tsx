import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { ChoiceField, dismissOpenChoice } from "@/components/choice-field";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { PASSWORD_RULES } from "@/password-rules";
import { errorMessage, hallFetch, useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const STEP_MS = 220;
const PAUSE_MS = 600;

const COURSES = [
  "BA LLB",
  "LLM",
  "BSc Industrial Chemistry",
  "MSc Industrial Chemistry",
  "MSc Wildlife and Biodiversity",
  "MTech Agricultural Process and Food Engineering",
  "MBA",
  "MBA International Business",
  "PG Islamic Banking and Finance",
  "BA Theology (Sunni)",
  "BA Theology (Shia)",
  "PhD Agriculture",
  "PhD Arts",
  "PhD Commerce",
  "PhD Law",
  "PhD Life Sciences",
  "PhD Theology",
] as const;

type RoomOption = {
  id: string;
  label: string;
};

type BlockOption = {
  id: string;
  name: string;
  rooms: RoomOption[];
};

const EMPTY_ROOMS = "No rooms are open";
const HALL_UNREACHABLE = "The hall could not be reached";
const PHONE_LINE = "Use an Indian mobile: +91 and exactly 10 digits";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hallBlockKey(name: string): string | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  const match = /^(?:block\s+)?([abcd])$/.exec(normalized);
  return match?.[1] ?? null;
}

function isHallBlock(name: string): boolean {
  return hallBlockKey(name) !== null;
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
    if (!isHallBlock(item.name)) {
      continue;
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
    return "Use 120 characters or fewer";
  }
  return null;
}

function enrolmentError(value: string): string | null {
  const length = trimmedLength(value);
  if (length < 1) {
    return "Enter your enrolment number";
  }
  if (length > 40) {
    return "Use 40 characters or fewer";
  }
  return null;
}

function failingPasswordRule(value: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) {
      return rule.label;
    }
  }
  return null;
}

function passwordRulesMet(value: string): boolean {
  return value.length > 0 && failingPasswordRule(value) === null && value.length <= 200;
}

function droppedOneCharacter(previous: string, incoming: string): boolean {
  if (incoming.length !== previous.length - 1) {
    return false;
  }
  let index = 0;
  while (index < incoming.length && previous[index] === incoming[index]) {
    index += 1;
  }
  return previous.slice(index + 1) === incoming.slice(index);
}

function securePasswordEdit(previous: string, incoming: string): string {
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  if (droppedOneCharacter(previous, incoming)) {
    return incoming;
  }
  if (incoming.length === 0) {
    return previous;
  }
  return previous + incoming;
}

function digits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function e164(value: string): string {
  return `+91${digits(value)}`;
}

function phoneError(value: string): string | null {
  if (!/^\d{10}$/.test(digits(value))) {
    return PHONE_LINE;
  }
  return null;
}

function shown(visible: boolean, message: string | null): string | null {
  return visible ? message : null;
}

function isCourse(value: string | null): value is (typeof COURSES)[number] {
  return value !== null && (COURSES as readonly string[]).includes(value);
}

function useFieldMessage(): { visible: boolean; reveal: () => void; onEdit: () => void } {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEdit = useCallback(() => {
    setVisible(false);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      setVisible(true);
    }, PAUSE_MS);
  }, []);

  const reveal = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setVisible(true);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { visible, reveal, onEdit };
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

type SignupDraft = {
  step: number;
  fullName: string;
  enrolment: string;
  password: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  course: string | null;
  blockId: string | null;
  roomId: string | null;
  blockTouched: boolean;
  accountCreated: boolean;
};

function emptySignupDraft(): SignupDraft {
  return {
    step: 0,
    fullName: "",
    enrolment: "",
    password: "",
    phone: "",
    guardianName: "",
    guardianPhone: "",
    course: null,
    blockId: null,
    roomId: null,
    blockTouched: false,
    accountCreated: false,
  };
}

let signupDraft = emptySignupDraft();

export default function OnboardScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { onboard, signIn } = useSession();
  const [step, setStep] = useState(signupDraft.step);
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choiceAttempt, setChoiceAttempt] = useState(false);
  const [fullName, setFullName] = useState(signupDraft.fullName);
  const [enrolment, setEnrolment] = useState(signupDraft.enrolment);
  const [password, setPassword] = useState(signupDraft.password);
  const passwordRef = useRef(signupDraft.password);
  const [phone, setPhone] = useState(signupDraft.phone);
  const [guardianName, setGuardianName] = useState(signupDraft.guardianName);
  const [guardianPhone, setGuardianPhone] = useState(signupDraft.guardianPhone);
  const [course, setCourse] = useState<string | null>(signupDraft.course);
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [listNote, setListNote] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(
    signupDraft.blockTouched ? signupDraft.blockId : null,
  );
  const [roomId, setRoomId] = useState<string | null>(
    signupDraft.blockTouched ? signupDraft.roomId : null,
  );
  const [paneWidth, setPaneWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const stepRef = useRef(signupDraft.step);
  const furthestRef = useRef(signupDraft.step);
  const showStepRef = useRef<(next: number) => void>(() => {});
  const backLock = useRef(false);
  const blockTouched = useRef(signupDraft.blockTouched);
  const accountCreated = useRef(signupDraft.accountCreated);
  const pending = useRef(false);
  const keepDraft = useRef(true);
  const fullNameField = useFieldMessage();
  const enrolmentField = useFieldMessage();
  const phoneField = useFieldMessage();
  const passwordField = useFieldMessage();
  const guardianNameField = useFieldMessage();
  const guardianPhoneField = useFieldMessage();

  const block = blocks.find((item) => item.id === blockId) ?? null;
  const room = block?.rooms.find((item) => item.id === roomId) ?? null;
  const rooms = block?.rooms ?? [];
  const blockItems = useMemo(
    () => blocks.map((item) => ({ id: item.id, label: item.name })),
    [blocks],
  );
  const courseItems = useMemo(
    () => COURSES.map((label) => ({ id: label, label })),
    [],
  );

  stepRef.current = step;

  useEffect(() => {
    if (!keepDraft.current) {
      return;
    }
    signupDraft = {
      step,
      fullName,
      enrolment,
      password,
      phone,
      guardianName,
      guardianPhone,
      course,
      blockId,
      roomId,
      blockTouched: blockTouched.current,
      accountCreated: accountCreated.current,
    };
  }, [
    blockId,
    course,
    enrolment,
    fullName,
    guardianName,
    guardianPhone,
    password,
    phone,
    roomId,
    step,
  ]);

  useEffect(() => {
    let active = true;
    hallFetch("/api/v1/auth/onboard/options", { method: "GET" })
      .then(async (response) => {
        if (!active) {
          return;
        }
        if (!response.ok) {
          const message = await errorMessage(response);
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

  const showStep = useCallback(
    (next: number) => {
      if (next === stepRef.current || next < 0 || next > 2) {
        return;
      }
      stepRef.current = next;
      if (next > furthestRef.current) {
        furthestRef.current = next;
      }
      setStep(next);
      setError(null);
      const width = widthRef.current;
      if (width <= 0) {
        return;
      }
      Animated.timing(offset, {
        toValue: -next * width,
        duration: STEP_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [offset],
  );
  showStepRef.current = showStep;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => dismissOpenChoice());
    return () => subscription.remove();
  }, []);

  usePreventRemove(step > 0 && !entered, () => {
    if (dismissOpenChoice()) {
      return;
    }
    if (backLock.current) {
      return;
    }
    backLock.current = true;
    showStepRef.current(stepRef.current - 1);
    requestAnimationFrame(() => {
      backLock.current = false;
    });
  });

  useEffect(() => {
    if (entered) {
      router.replace("/home");
    }
  }, [entered]);

  const onViewport = useCallback(
    (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      if (next <= 0 || next === widthRef.current) {
        return;
      }
      widthRef.current = next;
      setPaneWidth(next);
      offset.setValue(-stepRef.current * next);
    },
    [offset],
  );

  const chooseBlock = useCallback(
    (id: string) => {
      const item = blocks.find((entry) => entry.id === id);
      if (!item) {
        return;
      }
      blockTouched.current = true;
      if (id !== blockId) {
        setRoomId(null);
      }
      setBlockId(id);
      setError(null);
    },
    [blockId, blocks],
  );

  const chooseRoom = useCallback(
    (id: string) => {
      if (!rooms.some((entry) => entry.id === id)) {
        return;
      }
      setRoomId(id);
      setError(null);
    },
    [rooms],
  );

  const chooseCourse = useCallback((label: string) => {
    if (!isCourse(label)) {
      return;
    }
    setCourse(label);
    setError(null);
  }, []);

  const onPhone = useCallback(
    (value: string) => {
      const next = digits(value);
      if (next === phone) {
        return;
      }
      setPhone(next);
      phoneField.onEdit();
      setError(null);
    },
    [phone, phoneField],
  );

  const onPassword = useCallback(
    (value: string) => {
      const previous = passwordRef.current;
      const next = Platform.OS === "ios" ? securePasswordEdit(previous, value) : value;
      if (next === previous) {
        return;
      }
      passwordRef.current = next;
      setPassword(next);
      passwordField.onEdit();
      setError(null);
    },
    [passwordField],
  );

  const onGuardianPhone = useCallback(
    (value: string) => {
      const next = digits(value);
      if (next === guardianPhone) {
        return;
      }
      setGuardianPhone(next);
      guardianPhoneField.onEdit();
      setError(null);
    },
    [guardianPhone, guardianPhoneField],
  );

  const personInvalid = useCallback(() => {
    return (
      personError(fullName, "Enter your full name") !== null ||
      enrolmentError(enrolment) !== null ||
      phoneError(phone) !== null ||
      !passwordRulesMet(password)
    );
  }, [enrolment, fullName, password, phone]);

  const contactInvalid = useCallback(() => {
    return (
      personError(guardianName, "Enter the guardian name") !== null ||
      phoneError(guardianPhone) !== null
    );
  }, [guardianName, guardianPhone]);

  const revealPerson = useCallback(() => {
    fullNameField.reveal();
    enrolmentField.reveal();
    phoneField.reveal();
    passwordField.reveal();
  }, [enrolmentField, fullNameField, passwordField, phoneField]);

  const revealContact = useCallback(() => {
    guardianNameField.reveal();
    guardianPhoneField.reveal();
  }, [guardianNameField, guardianPhoneField]);

  const submit = useCallback(async () => {
    if (pending.current) {
      return;
    }
    const selectedBlock = blocks.find((item) => item.id === blockId) ?? null;
    const selectedRoom = selectedBlock?.rooms.find((item) => item.id === roomId) ?? null;
    if (personInvalid()) {
      revealPerson();
      showStep(0);
      return;
    }
    if (contactInvalid()) {
      revealContact();
      showStep(1);
      return;
    }
    if (!selectedBlock || !selectedRoom || !isCourse(course)) {
      setChoiceAttempt(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      if (!accountCreated.current) {
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
        if (message) {
          setError(message);
          return;
        }
        accountCreated.current = true;
        signupDraft = { ...signupDraft, accountCreated: true };
      }
      const signInError = await signIn(enrolment, password);
      if (signInError) {
        setError(signInError);
        return;
      }
      keepDraft.current = false;
      signupDraft = emptySignupDraft();
      setEntered(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [
    blockId,
    blocks,
    contactInvalid,
    course,
    enrolment,
    fullName,
    guardianName,
    guardianPhone,
    onboard,
    password,
    signIn,
    personInvalid,
    phone,
    revealContact,
    revealPerson,
    roomId,
    showStep,
  ]);

  const advance = useCallback(() => {
    if (pending.current) {
      return;
    }
    if (step === 0) {
      revealPerson();
      if (personInvalid()) {
        return;
      }
      showStep(1);
      return;
    }
    if (step === 1) {
      revealContact();
      if (contactInvalid()) {
        return;
      }
      showStep(2);
    }
  }, [contactInvalid, personInvalid, revealContact, revealPerson, showStep, step]);

  const onStepSwipe = useCallback(
    (translationX: number, translationY: number) => {
      if (Math.abs(translationX) < 48 || Math.abs(translationY) > Math.abs(translationX)) {
        return;
      }
      if (translationX > 0) {
        const previous = stepRef.current - 1;
        if (previous >= 0 && furthestRef.current > previous) {
          showStep(previous);
        }
        return;
      }
      advance();
    },
    [advance, showStep],
  );

  const stepSwipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event, success) => {
          if (!success) {
            return;
          }
          onStepSwipe(event.translationX, event.translationY);
        }),
    [onStepSwipe],
  );

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };

  const nameNote = shown(fullNameField.visible, personError(fullName, "Enter your full name"));
  const enrolmentNote = shown(enrolmentField.visible, enrolmentError(enrolment));
  const passwordNote = shown(
    passwordField.visible,
    password.length > 200 ? "Use 200 characters or fewer" : failingPasswordRule(password),
  );
  const ownPhoneNote = shown(phoneField.visible, phoneError(phone));
  const guardianNameNote = shown(
    guardianNameField.visible,
    personError(guardianName, "Enter the guardian name"),
  );
  const guardianPhoneNote = shown(guardianPhoneField.visible, phoneError(guardianPhone));
  const blockNote = choiceAttempt && block === null ? "Choose a block" : null;
  const roomNote = choiceAttempt && room === null ? "Choose a room" : null;
  const courseNote = choiceAttempt && !isCourse(course) ? "Choose a course" : null;
  const action = step < 2 ? "Continue" : "Sign up";

  const person = (
    <View style={styles.fields}>
      <View style={styles.noteBlock}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            fullNameField.onEdit();
            setError(null);
          }}
          autoCapitalize="sentences"
          autoComplete="off"
          returnKeyType="next"
        />
        {nameNote ? <Text style={[text.error, { color: colors.danger }]}>{nameNote}</Text> : null}
      </View>
      <View style={styles.noteBlock}>
        <TextField
          label="Enrolment number"
          value={enrolment}
          onChangeText={(value) => {
            setEnrolment(value);
            enrolmentField.onEdit();
            setError(null);
          }}
          autoComplete="off"
          returnKeyType="next"
        />
        {enrolmentNote ? (
          <Text style={[text.error, { color: colors.danger }]}>{enrolmentNote}</Text>
        ) : null}
      </View>
      <View style={styles.noteBlock}>
        <TextField
          label="Phone"
          value={phone}
          onChangeText={onPhone}
          autoComplete="off"
          keyboardType="number-pad"
          maxLength={10}
          prefix={dialCode(colors.ink)}
          returnKeyType="next"
        />
        {ownPhoneNote ? (
          <Text style={[text.error, { color: colors.danger }]}>{ownPhoneNote}</Text>
        ) : null}
      </View>
      <View style={styles.noteBlock}>
        <TextField
          label="Password"
          value={password}
          onChangeText={onPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={advance}
        />
        {passwordNote ? (
          <Text style={[text.error, { color: colors.danger }]}>{passwordNote}</Text>
        ) : null}
      </View>
    </View>
  );

  const contact = (
    <View style={styles.fields}>
      <View style={styles.noteBlock}>
        <TextField
          label="Guardian name"
          value={guardianName}
          onChangeText={(value) => {
            setGuardianName(value);
            guardianNameField.onEdit();
            setError(null);
          }}
          autoCapitalize="sentences"
          autoComplete="off"
          returnKeyType="next"
        />
        {guardianNameNote ? (
          <Text style={[text.error, { color: colors.danger }]}>{guardianNameNote}</Text>
        ) : null}
      </View>
      <View style={styles.noteBlock}>
        <TextField
          label="Guardian phone"
          value={guardianPhone}
          onChangeText={onGuardianPhone}
          autoComplete="off"
          keyboardType="number-pad"
          maxLength={10}
          prefix={dialCode(colors.ink)}
          returnKeyType="go"
          onSubmitEditing={advance}
        />
        {guardianPhoneNote ? (
          <Text style={[text.error, { color: colors.danger }]}>{guardianPhoneNote}</Text>
        ) : null}
      </View>
    </View>
  );

  const roomStep = (
    <View style={styles.fields}>
      <ChoiceField
        label="Block"
        placeholder="Select your block"
        valueLabel={block?.name ?? null}
        items={blockItems}
        selectedId={blockId}
        onPick={chooseBlock}
        colors={colors}
        hint={listNote}
        note={blockNote}
      />
      <ChoiceField
        label="Room"
        valueLabel={room?.label ?? null}
        items={rooms}
        selectedId={roomId}
        onPick={chooseRoom}
        colors={colors}
        hint={block && rooms.length === 0 ? EMPTY_ROOMS : null}
        note={roomNote}
      />
      <ChoiceField
        label="Course"
        valueLabel={course}
        items={courseItems}
        selectedId={course}
        onPick={chooseCourse}
        colors={colors}
        note={courseNote}
      />
    </View>
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.dismiss} onPress={dismissOpenChoice}>
      <View style={styles.progress}>
        <View style={styles.track}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.segment,
                { backgroundColor: index < step ? colors.forest : colors.line },
              ]}
            />
          ))}
        </View>
        <View style={styles.hits}>
          {[0, 1, 2].map((index) => (
            <Pressable
              key={index}
              style={styles.hit}
              accessibilityRole="button"
              accessibilityState={{ selected: index === step }}
              onPress={() => {
                if (index < step) {
                  showStep(index);
                }
              }}
            />
          ))}
        </View>
      </View>
      <GestureDetector gesture={stepSwipe}>
        <View style={styles.viewport} onLayout={onViewport}>
          <Animated.View
            style={[
              styles.row,
              {
                width: paneWidth > 0 ? paneWidth * 3 : undefined,
                transform: [{ translateX: offset }],
              },
            ]}
          >
            <View style={[styles.pane, paneWidth > 0 ? { width: paneWidth } : null]}>{person}</View>
            <View style={[styles.pane, paneWidth > 0 ? { width: paneWidth } : null]}>{contact}</View>
            <View style={[styles.pane, paneWidth > 0 ? { width: paneWidth } : null]}>{roomStep}</View>
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.action}>
        <HallButton
          label={action}
          disabled={busy}
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
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dismiss: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  progress: {
    height: 28,
    justifyContent: "center",
    marginBottom: 20,
  },
  track: {
    flexDirection: "row",
    gap: 4,
    height: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  hits: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
  },
  hit: { flex: 1 },
  viewport: { overflow: "hidden" },
  row: { flexDirection: "row", flexShrink: 0 },
  pane: { flexShrink: 0 },
  fields: { gap: 16 },
  noteBlock: { gap: 8 },
  action: { marginTop: 16 },
  dial: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
  },
  flag: { fontSize: 18 },

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
});
