import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { HALL_ZONE, formatChipDay, formatWhenParts, utcInstant } from "@/format-when";
import { useDark } from "@/theme/appearance";
import { useHallColors, type HallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Ordinary hours are the seeded summer and winter outing clocks. The start is
// not included. The end is included. Any other time stays selectable, and the
// plan asks her to use the Permissions tab.
const SUMMER_START = "04-01";
const WINTER_START = "10-01";
const DAY_START = "06:30";
const SUMMER_END = "18:30";
const WINTER_END = "17:30";

const START_FUTURE = "The outing start must be in the future";
const RETURN_FUTURE = "The expected return must be in the future";
const RETURN_AFTER = "The expected return must be after the start";
const SAME_DAY = "An ordinary outing starts and returns on the same hall day";
const OUTSIDE_HOURS =
  "These hours fall outside ordinary hours. Please request permission from the Permissions tab";

const hallFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: HALL_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function hallPart(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  return hallFormat.formatToParts(date).find((item) => item.type === type)?.value ?? "";
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

function wallUtc(date: Date): number {
  return new Date(
    `${hallDay(date)}T${hallPart(date, "hour")}:${hallPart(date, "minute")}:${hallPart(date, "second")}Z`,
  ).getTime();
}

function hallInstant(daySource: Date, hour: number, minute: number): Date {
  const [year, month, date] = hallDay(daySource).split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, date, hour, minute, 0));
  return new Date(guess.getTime() - (wallUtc(guess) - guess.getTime()));
}

export function hallAt(day: string, hour: number, minute: number): Date {
  const [year, month, date] = day.split("-").map(Number);
  return hallInstant(new Date(Date.UTC(year, month - 1, date, 12, 0, 0)), hour, minute);
}

function withHallDay(daySource: Date, timeSource: Date): Date {
  return hallInstant(
    daySource,
    Number(hallPart(timeSource, "hour")),
    Number(hallPart(timeSource, "minute")),
  );
}

function proposalWhen(): Date {
  return hallInstant(new Date(), Number(DAY_START.slice(0, 2)) + 1, 0);
}

function seasonEnd(date: Date): string {
  const day = monthDay(date);
  const summer = SUMMER_START <= day && day < WINTER_START;
  return summer ? SUMMER_END : WINTER_END;
}

function hoursNote(date: Date): string | null {
  const clock = hallClock(date);
  if (clock <= `${DAY_START}:00` || clock > `${seasonEnd(date)}:00`) {
    return OUTSIDE_HOURS;
  }
  return null;
}

export function notBefore(floor: Date, current: Date | null): Date | null {
  const base = current ?? proposalWhen();
  if (hallDay(base) >= hallDay(floor)) {
    return current;
  }
  return withHallDay(floor, base);
}

function shiftHallDay(daySource: Date, days: number): Date {
  const [year, month, date] = hallDay(daySource).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days, 12, 0, 0));
}

function hallHourMinute(date: Date): { hour: number; minute: number } {
  return {
    hour: Number(hallPart(date, "hour")),
    minute: Number(hallPart(date, "minute")),
  };
}

export function isNextHallMidnight(leave: Date, back: Date): boolean {
  const clock = hallHourMinute(back);
  if (clock.hour !== 0 || clock.minute !== 0) {
    return false;
  }
  return hallDay(back) === hallDay(shiftHallDay(leave, 1));
}

/** Late night stays on the leave day. 12:00 AM the next day is the only later instant. */
export function sameNight(leave: Date, back: Date | null): Date | null {
  if (back && isNextHallMidnight(leave, back) && back.getTime() > leave.getTime()) {
    return back;
  }
  const clockSource = back ?? leave;
  const sameDay = withHallDay(leave, clockSource);
  if (sameDay.getTime() > leave.getTime()) {
    return sameDay;
  }
  const hourLater = new Date(leave.getTime() + 60 * 60 * 1000);
  if (hallDay(hourLater) === hallDay(leave)) {
    return hourLater;
  }
  return hallAt(hallDay(shiftHallDay(leave, 1)), 0, 0);
}

function commitDay(shown: Date, date: Date | undefined, onChange: (next: Date) => void) {
  if (!date) {
    return;
  }
  applyWhen(withHallDay(date, shown), shown, onChange);
}

function commitClock(shown: Date, date: Date | undefined, onChange: (next: Date) => void) {
  if (!date) {
    return;
  }
  applyWhen(withHallDay(shown, date), shown, onChange);
}

export function leaveNote(leaveAt: Date | null): string | null {
  if (!leaveAt) {
    return null;
  }
  if (leaveAt.getTime() <= Date.now()) {
    return START_FUTURE;
  }
  return hoursNote(leaveAt);
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
  return hoursNote(backBy);
}

function sameHallMinute(left: Date, right: Date): boolean {
  return (
    hallDay(left) === hallDay(right) &&
    hallPart(left, "hour") === hallPart(right, "hour") &&
    hallPart(left, "minute") === hallPart(right, "minute")
  );
}

function applyWhen(next: Date, shown: Date, onChange: (date: Date) => void) {
  if (sameHallMinute(next, shown)) {
    return;
  }
  onChange(next);
}

function AndroidWhen({
  label,
  shown,
  value,
  colors,
  clockFirst,
  onChange,
}: {
  label: string;
  shown: Date;
  value: Date | null;
  colors: HallColors;
  clockFirst: boolean;
  onChange: (date: Date) => void;
}) {
  const instant = utcInstant(value ?? shown);
  const pieces = formatWhenParts(instant);
  const dayText = pieces?.day ?? instant;
  const clockText = pieces?.clock ?? "";
  const ink = value ? colors.ink : colors.inkFaint;

  const openDate = () => {
    DateTimePickerAndroid.open({
      value: shown,
      mode: "date",
      timeZoneName: HALL_ZONE,
      onValueChange: (_event, date) => {
        commitDay(shown, date, onChange);
      },
    });
  };

  const openTime = () => {
    DateTimePickerAndroid.open({
      value: shown,
      mode: "time",
      timeZoneName: HALL_ZONE,
      onValueChange: (_event, date) => {
        commitClock(shown, date, onChange);
      },
    });
  };

  const dateControl = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${dayText}` : `${label}, date`}
      onPress={openDate}
    >
      <Text style={[text.field, { color: ink }]}>{dayText}</Text>
    </Pressable>
  );
  const timeControl = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${clockText}` : `${label}, time`}
      onPress={openTime}
    >
      <Text style={[text.field, { color: ink }]}>{clockText}</Text>
    </Pressable>
  );

  return (
    <View style={styles.controls}>
      {clockFirst ? timeControl : dateControl}
      {clockFirst ? dateControl : timeControl}
    </View>
  );
}

function IosWhen({
  shown,
  colors,
  clockFirst,
  onChange,
  onDismiss,
}: {
  shown: Date;
  colors: HallColors;
  clockFirst: boolean;
  onChange: (date: Date) => void;
  onDismiss?: () => void;
}) {
  const dark = useDark();
  const [datePickerKey, setDatePickerKey] = useState(0);
  const ignoreClockUntil = useRef(0);
  const when = formatWhenParts(shown.toISOString());
  const dayLabel = formatChipDay(shown);
  const dateChip = (
    <View style={[styles.chip, { backgroundColor: colors.chip }]}>
      <Text style={[styles.chipText, { color: colors.ink }]}>{dayLabel}</Text>
      <DateTimePicker
        key={datePickerKey}
        style={styles.chipHit}
        value={shown}
        mode="date"
        display="compact"
        accentColor={colors.forest}
        themeVariant={dark ? "dark" : "light"}
        timeZoneName={HALL_ZONE}
        onDismiss={onDismiss}
        onValueChange={(_event, date) => {
          if (!date || hallDay(date) === hallDay(shown)) {
            return;
          }
          ignoreClockUntil.current = Date.now() + 500;
          commitDay(shown, date, onChange);
          setDatePickerKey((key) => key + 1);
        }}
      />
    </View>
  );
  const timeChip = (
    <View style={[styles.chip, { backgroundColor: colors.chip }]}>
      <Text style={[styles.chipText, { color: colors.ink }]}>{when?.clock ?? ""}</Text>
      <DateTimePicker
        style={styles.chipHit}
        value={shown}
        mode="time"
        display="compact"
        accentColor={colors.forest}
        themeVariant={dark ? "dark" : "light"}
        timeZoneName={HALL_ZONE}
        onDismiss={onDismiss}
        onValueChange={(_event, date) => {
          if (Date.now() < ignoreClockUntil.current) {
            return;
          }
          commitClock(shown, date, onChange);
        }}
      />
    </View>
  );

  return (
    <View style={styles.controls}>
      {clockFirst ? timeChip : dateChip}
      {clockFirst ? dateChip : timeChip}
    </View>
  );
}

export function WhenField({
  label,
  value,
  onChange,
  onAdjust,
  note,
  clockFirst = false,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  onAdjust?: () => void;
  note: string | null;
  clockFirst?: boolean;
}) {
  const colors = useHallColors();
  const shown = value ?? proposalWhen();
  const change = (date: Date) => {
    onAdjust?.();
    onChange(date);
  };

  return (
    <View style={styles.field}>
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      {Platform.OS === "ios" ? (
        <IosWhen
          shown={shown}
          colors={colors}
          clockFirst={clockFirst}
          onChange={change}
          onDismiss={onAdjust}
        />
      ) : (
        <AndroidWhen
          label={label}
          shown={shown}
          value={value}
          colors={colors}
          clockFirst={clockFirst}
          onChange={change}
        />
      )}
      {note ? <Text accessibilityLiveRegion="polite" style={[text.error, { color: colors.danger }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chip: {
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
  },
  chipHit: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
  },
});
