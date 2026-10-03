import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { hallFetch, useSession } from "@/session";
import { useHallColors, type HallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const PHONE = /^\+[1-9][0-9]{7,14}$/;
const STEP_MS = 220;
const PAUSE_MS = 600;

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

type Choice = {
  id: string;
  label: string;
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
      continue;
    }
    blocks.push({ id: item.id, name: item.name, rooms });
  }
  return blocks;
}

function openingBlock(options: BlockOption[]): BlockOption | null {
  return (
    options.find((item) => {
      const name = item.name.trim().toLowerCase();
      return name === "b" || name === "block b";
    }) ?? null
  );
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

function failingPasswordRule(value: string): string | null {
  if (value.length === 0) {
    return null;
  }
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

function digits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function e164(value: string): string {
  return `+91${digits(value)}`;
}

function phoneError(value: string): string | null {
  const dial = digits(value);
  if (!/^\d{10}$/.test(dial) || !PHONE.test(e164(dial))) {
    return PHONE_LINE;
  }
  return null;
}

function phoneNote(value: string, visible: boolean): string | null {
  if (!visible || digits(value).length === 0 || phoneError(value) === null) {
    return null;
  }
  return PHONE_LINE;
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

function OptionList({
  items,
  selectedId,
  onPick,
  colors,
}: {
  items: Choice[];
  selectedId: string | null;
  onPick: (id: string) => void;
  colors: HallColors;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <View style={styles.choice}>
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onPick(item.id)}
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
  );
}

function ChoiceField({
  label,
  valueLabel,
  items,
  selectedId,
  onPick,
  colors,
  openShowsAll,
  note,
  hint,
}: {
  label: string;
  valueLabel: string | null;
  items: Choice[];
  selectedId: string | null;
  onPick: (id: string) => void;
  colors: HallColors;
  openShowsAll: boolean;
  note: string | null;
  hint?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return openShowsAll ? items : [];
    }
    return items.filter((item) => item.label.toLowerCase().includes(needle));
  }, [items, openShowsAll, query]);

  const pick = useCallback(
    (id: string) => {
      onPick(id);
      setOpen(false);
      setQuery("");
    },
    [onPick],
  );

  return (
    <View style={styles.noteBlock}>
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      {open ? (
        <View
          style={[
            styles.shell,
            { backgroundColor: colors.surface, borderColor: colors.forest },
          ]}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={label}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.forest}
            cursorColor={colors.forest}
            accessibilityLabel={label}
            style={[styles.shellInput, text.field, { color: colors.ink }]}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={valueLabel ? `${label}, ${valueLabel}` : label}
          onPress={() => {
            setQuery("");
            setOpen(true);
          }}
          style={[
            styles.shell,
            styles.shellPad,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Text style={[text.field, { color: valueLabel ? colors.ink : colors.inkFaint }]}>
            {valueLabel ?? label}
          </Text>
        </Pressable>
      )}
      {open ? (
        <OptionList items={hits} selectedId={selectedId} onPick={pick} colors={colors} />
      ) : null}
      {hint ? <Text style={[text.body, { color: colors.inkSoft }]}>{hint}</Text> : null}
      {note ? <Text style={[text.error, { color: colors.inkSoft }]}>{note}</Text> : null}
    </View>
  );
}

export default function OnboardScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { onboard } = useSession();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choiceAttempt, setChoiceAttempt] = useState(false);
  const [fullName, setFullName] = useState("");
  const [enrolment, setEnrolment] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [course, setCourse] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [listNote, setListNote] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const stepRef = useRef(0);
  const showStepRef = useRef<(next: number) => void>(() => {});
  const backLock = useRef(false);
  const blockTouched = useRef(false);
  const pending = useRef(false);
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
        if (!blockTouched.current) {
          const opening = openingBlock(parsed);
          setBlockId(opening?.id ?? null);
        }
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

  usePreventRemove(step > 0 && !ready, () => {
    if (backLock.current) {
      return;
    }
    backLock.current = true;
    showStepRef.current(stepRef.current - 1);
    requestAnimationFrame(() => {
      backLock.current = false;
    });
  });

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
      personError(fullName, "Enter your full name.") !== null ||
      enrolmentError(enrolment) !== null ||
      password.length > 200 ||
      phoneError(phone) !== null ||
      !passwordRulesMet(password)
    );
  }, [enrolment, fullName, password, phone]);

  const contactInvalid = useCallback(() => {
    return (
      personError(guardianName, "Enter the guardian name.") !== null ||
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
      setReady(true);
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

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };

  if (ready) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.paper }]}
        contentContainerStyle={[styles.content, frame]}
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

  const nameNote = shown(fullNameField.visible, personError(fullName, "Enter your full name."));
  const enrolmentNote = shown(enrolmentField.visible, enrolmentError(enrolment));
  const passwordLengthNote = shown(
    passwordField.visible,
    password.length > 200 ? "Use 200 characters or fewer." : null,
  );
  const passwordRuleNote = shown(passwordField.visible, failingPasswordRule(password));
  const ownPhoneNote = phoneNote(phone, phoneField.visible);
  const guardianNameNote = shown(
    guardianNameField.visible,
    personError(guardianName, "Enter the guardian name."),
  );
  const guardianPhoneNote = phoneNote(guardianPhone, guardianPhoneField.visible);
  const blockNote = choiceAttempt && block === null ? "Choose a block." : null;
  const roomNote = choiceAttempt && room === null ? "Choose a room." : null;
  const courseNote = choiceAttempt && !isCourse(course) ? "Choose a course." : null;
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
        {nameNote ? <Text style={[text.error, { color: colors.inkSoft }]}>{nameNote}</Text> : null}
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
          <Text style={[text.error, { color: colors.inkSoft }]}>{enrolmentNote}</Text>
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
          <Text style={[text.error, { color: colors.inkSoft }]}>{ownPhoneNote}</Text>
        ) : null}
      </View>
      <View style={styles.noteBlock}>
        <TextField
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            passwordField.onEdit();
            setError(null);
          }}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={advance}
        />
        {passwordLengthNote || passwordRuleNote ? (
          <View style={styles.rules}>
            {passwordLengthNote ? (
              <Text style={[text.error, { color: colors.inkSoft }]}>{passwordLengthNote}</Text>
            ) : null}
            {passwordRuleNote ? (
              <Text style={[text.error, { color: colors.inkSoft }]}>{passwordRuleNote}</Text>
            ) : null}
          </View>
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
          <Text style={[text.error, { color: colors.inkSoft }]}>{guardianNameNote}</Text>
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
          <Text style={[text.error, { color: colors.inkSoft }]}>{guardianPhoneNote}</Text>
        ) : null}
      </View>
    </View>
  );

  const roomStep = (
    <View style={styles.fields}>
      <ChoiceField
        label="Block"
        valueLabel={block?.name ?? null}
        items={blockItems}
        selectedId={blockId}
        onPick={chooseBlock}
        colors={colors}
        openShowsAll
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
        openShowsAll={false}
        note={roomNote}
      />
      <ChoiceField
        label="Course"
        valueLabel={course}
        items={courseItems}
        selectedId={course}
        onPick={chooseCourse}
        colors={colors}
        openShowsAll
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  segment: { flex: 1 },
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
  rules: { gap: 2 },
  action: { marginTop: 16 },
  dial: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
  },
  flag: { fontSize: 18 },
  shell: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    justifyContent: "center",
  },
  shellPad: { paddingHorizontal: 14 },
  shellInput: {
    height: "100%",
    paddingVertical: 0,
    paddingHorizontal: 14,
  },
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
