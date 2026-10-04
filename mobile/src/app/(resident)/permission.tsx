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
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Alert, InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { formatWhenParts, utcInstant } from "@/format-when";
import { WhenField, hallAt, hallDay, isNextHallMidnight, sameNight } from "@/outing-when";
import {
  useSession,
  type HallPermission,
  type PermissionKind,
  type PermissionStatus,
} from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function paramText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return raw.trim();
}

function kindParam(value: string): PermissionKind | null {
  if (value === "late_night" || value === "home_going") {
    return value;
  }
  return null;
}

function openedWhen(iso: string): string {
  const pieces = formatWhenParts(iso);
  if (!pieces) {
    return iso;
  }
  return `${pieces.clock}, ${pieces.day}`;
}

function hallDayLabel(iso: string): string {
  return formatWhenParts(iso)?.day ?? iso;
}

function homeDeparture(day: string): Date {
  const start = hallAt(day, 0, 0);
  const now = new Date();
  return start.getTime() < now.getTime() ? now : start;
}

function homeReturn(day: string): Date {
  return hallAt(day, 23, 59);
}

function DateField({
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
  const dayLabel = value ? hallDayLabel(shown.toISOString()) : "Choose a date";
  const open = () => {
    DateTimePickerAndroid.open({
      value: shown,
      mode: "date",
      timeZoneName: "Asia/Kolkata",
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
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open} style={styles.datePress}>
          <Text style={[text.field, { color: value ? colors.ink : colors.inkFaint }]}>{dayLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{dayLabel}</Text>
          <DateTimePicker
            key={pickerKey}
            style={styles.chipHit}
            value={shown}
            mode="date"
            display="compact"
            accentColor={colors.forest}
            themeVariant="light"
            timeZoneName="Asia/Kolkata"
            onValueChange={(_event, date) => {
              if (!date || (value !== null && hallDay(date) === hallDay(value))) {
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

function kindLabel(kind: PermissionKind): string {
  return kind === "late_night" ? "Late-night" : "Home going";
}

function statusSentence(status: PermissionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "in_use":
      return "Out";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
  }
}

function statusTone(status: PermissionStatus, colors: ReturnType<typeof useHallColors>) {
  if (status === "approved" || status === "in_use") {
    return { color: colors.forest, border: colors.forest, background: colors.approvedBg };
  }
  if (status === "rejected") {
    return { color: colors.danger, border: colors.danger, background: colors.dangerBg };
  }
  if (status === "pending") {
    return { color: colors.pending, border: colors.pending, background: colors.pendingBg };
  }
  return { color: colors.inkSoft, border: colors.line, background: colors.surface };
}

function StatusPill({ status }: { status: PermissionStatus }) {
  const colors = useHallColors();
  const tone = statusTone(status, colors);
  return (
    <View style={[styles.status, { borderColor: tone.border, backgroundColor: tone.background }]}>
      <Text style={[styles.statusText, { color: tone.color }]}>{statusSentence(status)}</Text>
    </View>
  );
}

function departureNote(leaveAt: Date | null): string | null {
  if (!leaveAt) {
    return null;
  }
  if (leaveAt.getTime() < Date.now()) {
    return "Departure must not be in the past";
  }
  return null;
}

function returnAfterNote(leaveAt: Date | null, backBy: Date | null): string | null {
  if (!leaveAt || !backBy) {
    return null;
  }
  if (backBy.getTime() <= leaveAt.getTime()) {
    return "Expected return must be after departure";
  }
  return null;
}

function lateNightReturnNote(leaveAt: Date | null, backBy: Date | null): string | null {
  const order = returnAfterNote(leaveAt, backBy);
  if (order || !leaveAt || !backBy) {
    return order;
  }
  if (hallDay(leaveAt) === hallDay(backBy) || isNextHallMidnight(leaveAt, backBy)) {
    return null;
  }
  return "A late-night return has to be the same day. Only 12:00 AM can be the next day.";
}

function usePermissionBack() {
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

function BackButton({ onPress }: { onPress: () => void }) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={styles.back}
    >
      <Text style={[text.button, { color: colors.inkSoft }]}>Back</Text>
    </Pressable>
  );
}

function PermissionForm({
  kind,
  existing,
}: {
  kind: PermissionKind;
  existing?: HallPermission;
}) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { submitPermission, updatePermission, cancelPermission } = useSession();
  const back = usePermissionBack();
  const reduced = useReducedMotion();
  const formOpacity = useSharedValue(1);
  const formShift = useSharedValue(0);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.92);
  const lineOpacity = useSharedValue(0);
  const lineShift = useSharedValue(8);
  const [place, setPlace] = useState(existing?.shortPlace ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [leaveOn, setLeaveOn] = useState<Date | null>(
    existing && kind === "home_going" ? new Date(existing.departureAt) : null,
  );
  const [backOn, setBackOn] = useState<Date | null>(
    existing && kind === "home_going" ? new Date(existing.expectedReturnAt) : null,
  );
  const [leaveAt, setLeaveAt] = useState<Date | null>(
    existing && kind === "late_night" ? new Date(existing.departureAt) : null,
  );
  const [backBy, setBackBy] = useState<Date | null>(
    existing && kind === "late_night" ? new Date(existing.expectedReturnAt) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const pending = useRef(false);
  const holdSubmit = useRef(0);
  const alertAt = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = hallDay(new Date());
  const leaveDay = leaveOn ? hallDay(leaveOn) : "";
  const backDay = backOn ? hallDay(backOn) : "";
  const homeDatesReady = leaveDay.length > 0 && backDay.length > 0 && leaveDay >= today && backDay >= leaveDay;
  const homeTimes =
    kind === "home_going" && homeDatesReady
      ? { departure: homeDeparture(leaveDay), back: homeReturn(backDay) }
      : null;
  const leaveProblem =
    kind === "home_going"
      ? leaveDay.length > 0 && leaveDay < today
        ? "Leave must not be in the past"
        : null
      : departureNote(leaveAt);
  const backProblem =
    kind === "home_going"
      ? backDay.length > 0 && leaveDay.length > 0 && backDay < leaveDay
        ? "Back must be on or after the day you leave"
        : homeTimes !== null && homeTimes.back.getTime() <= homeTimes.departure.getTime()
          ? "Choose a later back date"
          : null
      : lateNightReturnNote(leaveAt, backBy);
  const ready =
    place.trim().length > 0 &&
    reason.trim().length > 0 &&
    (kind === "late_night" || address.trim().length > 0) &&
    (kind === "home_going"
      ? homeTimes !== null && backProblem === null
      : leaveAt !== null && backBy !== null) &&
    leaveProblem === null &&
    backProblem === null;

  const hold = useCallback(() => {
    holdSubmit.current = Date.now() + 700;
  }, []);

  const submit = useCallback(async () => {
    if (Date.now() < holdSubmit.current || pending.current) {
      return;
    }
    if (!ready) {
      return;
    }
    if (kind === "late_night" && (!leaveAt || !backBy)) {
      return;
    }
    if (kind === "home_going" && !homeTimes) {
      return;
    }
    pending.current = true;
    setError(null);
    const shortPlace = place.trim();
    const reasonText = reason.trim();
    const departureAt =
      kind === "home_going" && homeTimes ? utcInstant(homeTimes.departure) : utcInstant(leaveAt as Date);
    const expectedReturnAt =
      kind === "home_going" && homeTimes ? utcInstant(homeTimes.back) : utcInstant(backBy as Date);
    const body =
      kind === "late_night"
        ? {
            permission_type: "late_night" as const,
            short_place: shortPlace,
            reason: reasonText,
            departure_at: departureAt,
            expected_return_at: expectedReturnAt,
          }
        : {
            permission_type: "home_going" as const,
            short_place: shortPlace,
            address: address.trim(),
            reason: reasonText,
            departure_at: departureAt,
            expected_return_at: expectedReturnAt,
          };
    const message = existing
      ? await updatePermission(existing.id, body)
      : await submitPermission(body);
    pending.current = false;
    if (message) {
      setError(message);
      return;
    }
    setSent(true);
  }, [
    address,
    backBy,
    existing,
    homeTimes,
    kind,
    leaveAt,
    place,
    ready,
    reason,
    submitPermission,
    updatePermission,
  ]);

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

  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const frame = {
    paddingTop: insets.top + 28,
    paddingBottom: insets.bottom + 28,
  };

  const sentLine = existing
    ? "Your changes have been sent for approval"
    : "Your request has been submitted";

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
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <BackButton onPress={back} />
      <View style={styles.headingRow}>
        <Text style={[text.hallName, styles.title, styles.titleFlex, { color: colors.ink }]}>
          {kindLabel(kind)}
        </Text>
        {existing ? <StatusPill status="pending" /> : null}
      </View>
      {existing ? (
        <Text style={[text.body, { color: colors.ink }]}>Any change needs approval again</Text>
      ) : null}
      <View style={styles.fields}>
        <TextField
          label={kind === "late_night" ? "Place" : "City"}
          value={place}
          onChangeText={(value) => {
            setPlace(value);
            setError(null);
          }}
          autoCapitalize="sentences"
          autoComplete="off"
          maxLength={120}
        />
        {kind === "home_going" ? (
          <TextField
            label="Home address"
            value={address}
            onChangeText={(value) => {
              setAddress(value);
              setError(null);
            }}
            autoCapitalize="sentences"
            autoComplete="off"
            maxLength={300}
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
        {kind === "home_going" ? (
          <>
            <DateField
              label="Leave"
              value={leaveOn}
              onChange={(date) => {
                setLeaveOn(date);
                setBackOn((current) => {
                  if (!current || hallDay(current) >= hallDay(date)) {
                    return current;
                  }
                  return date;
                });
                setError(null);
              }}
            />
            <DateField
              label="Back"
              value={backOn}
              onChange={(date) => {
                setBackOn(date);
                setError(null);
              }}
            />
            {leaveProblem || backProblem ? (
              <Text style={[text.error, { color: colors.danger }]}>{leaveProblem ?? backProblem}</Text>
            ) : null}
          </>
        ) : (
          <>
            <WhenField
              label="Leave at"
              value={leaveAt}
              note={leaveProblem}
              clockFirst={existing !== undefined}
              onAdjust={hold}
              onChange={(date) => {
                if (!date) {
                  return;
                }
                setLeaveAt(date);
                setBackBy((current) => sameNight(date, current));
                setError(null);
              }}
            />
            <WhenField
              label="Back by"
              value={backBy}
              note={backProblem}
              clockFirst={existing !== undefined}
              onAdjust={hold}
              onChange={(date) => {
                setBackBy(date);
                setError(null);
              }}
            />
          </>
        )}
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
        {existing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel permission"
            onPress={() => {
              Alert.alert("Cancel permission", undefined, [
                { text: "Back", style: "cancel" },
                {
                  text: "Cancel permission",
                  style: "destructive",
                  onPress: () => {
                    alertAt.current = Date.now();
                    void cancelPermission(existing.id).then((failure) => {
                      if (failure) {
                        setError(failure.message);
                        return;
                      }
                      const wait = Math.max(0, 250 - (Date.now() - alertAt.current));
                      if (leaveTimer.current) {
                        clearTimeout(leaveTimer.current);
                      }
                      leaveTimer.current = setTimeout(() => {
                        InteractionManager.runAfterInteractions(back);
                      }, wait);
                    });
                  },
                },
              ]);
            }}
            style={styles.cancel}
          >
            <Text style={[text.button, { color: colors.danger }]}>Cancel permission</Text>
          </Pressable>
        ) : null}
        {error ? (
          <Text selectable style={[text.error, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>
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
      <Animated.Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={[text.body, styles.sentLine, { color: colors.ink }, lineMotion]}
      >
        {sentLine}
      </Animated.Text>
    </Animated.View>
    </View>
  );
}

function PermissionDetail({ id }: { id: string }) {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const { loadPermission, cancelPermission } = useSession();
  const back = usePermissionBack();
  const [permission, setPermission] = useState<HallPermission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const alertAt = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadPermissionRef = useRef(loadPermission);
  loadPermissionRef.current = loadPermission;

  const load = useCallback(() => {
    let active = true;
    void loadPermissionRef.current(id).then((result) => {
      if (!active) {
        return;
      }
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setPermission(result.permission);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useFocusEffect(load);

  // The alert is still closing when cancel returns. Navigating then drops the pop.
  const leaveWhenStill = useCallback(() => {
    const wait = Math.max(0, 250 - (Date.now() - alertAt.current));
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
    leaveTimer.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(back);
    }, wait);
  }, [back]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const confirmCancel = useCallback(async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setError(null);
    const failure = await cancelPermission(id);
    pending.current = false;
    if (failure) {
      setError(failure.message);
      const again = await loadPermission(id);
      if (again.error === null) {
        setPermission(again.permission);
      }
      return;
    }
    leaveWhenStill();
  }, [cancelPermission, id, leaveWhenStill, loadPermission]);

  const askCancel = useCallback(() => {
    Alert.alert("Cancel permission", undefined, [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel permission",
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
  const detail = permission?.destinationDetail?.trim() ?? "";
  const address = permission?.address?.trim() ?? "";
  const note = permission?.decisionNote?.trim() ?? "";
  const facts: { label: string; value: string }[] = [];
  if (permission) {
    if (detail.length > 0) {
      facts.push({ label: "Further detail", value: detail });
    }
    if (address.length > 0) {
      facts.push({ label: "Home address", value: address });
    }
    facts.push({ label: "Reason", value: permission.reason });
    if (permission.permissionType === "home_going") {
      facts.push({ label: "Leave", value: hallDayLabel(permission.departureAt) });
      facts.push({ label: "Back", value: hallDayLabel(permission.expectedReturnAt) });
    } else {
      facts.push({ label: "Leave at", value: openedWhen(permission.departureAt) });
      facts.push({ label: "Back by", value: openedWhen(permission.expectedReturnAt) });
    }
    const decider = permission.decidedBy?.trim() ?? "";
    if (decider.length > 0) {
      facts.push({
        label: permission.status === "rejected" ? "Rejected by" : "Approved by",
        value: decider,
      });
    }
    if (note.length > 0) {
      facts.push({ label: "Note", value: note });
    }
  }
  const canCancel = permission?.status === "pending" || permission?.status === "approved";

  if (permission?.status === "pending") {
    return <PermissionForm kind={permission.permissionType} existing={permission} />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[styles.content, frame]}
      showsVerticalScrollIndicator={false}
    >
      <BackButton onPress={back} />
      {permission ? (
        <View style={styles.block}>
          <View style={styles.heading}>
            <View style={styles.headingRow}>
              <Text style={[text.hallName, styles.title, styles.titleFlex, { color: colors.ink }]}>
                {permission.shortPlace}
              </Text>
              <StatusPill status={permission.status} />
            </View>
            <Text style={[text.body, { color: colors.inkSoft }]}>{kindLabel(permission.permissionType)}</Text>
          </View>
          <View>
            {facts.map((fact, index) => (
              <View
                key={fact.label}
                style={[
                  styles.fact,
                  index > 0
                    ? { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }
                    : null,
                ]}
              >
                <Text style={[text.label, { color: colors.inkSoft }]}>{fact.label}</Text>
                <Text selectable style={[text.body, { color: colors.ink }]}>
                  {fact.value}
                </Text>
              </View>
            ))}
          </View>
          {permission.status === "approved" ? (
            <Text style={[text.body, { color: colors.ink }]}>
              Show this to the gate staff shortly before you leave, and until you are due back.
            </Text>
          ) : null}
          {canCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel permission"
              onPress={askCancel}
              style={styles.cancel}
            >
              <Text style={[text.button, { color: colors.danger }]}>Cancel permission</Text>
            </Pressable>
          ) : null}
          {error ? (
            <Text selectable style={[text.error, { color: colors.danger }]}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : error ? (
        <Text selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function PermissionScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    kind?: string | string[];
  }>();
  const id = paramText(params.id);
  const kind = kindParam(paramText(params.kind));
  if (id.length > 0) {
    return <PermissionDetail key={id} id={id} />;
  }
  if (kind === null) {
    return <Redirect href="/permissions" />;
  }
  return <PermissionForm key={kind} kind={kind} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 16,
  },
  title: { textAlign: "left" },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  fields: { gap: 16 },
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
  block: { gap: 16 },
  heading: { gap: 8 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleFlex: { flex: 1 },
  status: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: "SourceSans3_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  fact: { paddingVertical: 12, gap: 4 },
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
  cancel: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
});
