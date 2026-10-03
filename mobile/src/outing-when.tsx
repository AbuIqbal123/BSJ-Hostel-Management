import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { formatWhenParts, utcInstant } from "@/format-when";
import { useHallColors, type HallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Seeded catalog name. backend/app/shared/migrations/0001_create_hall.sql stores 'Other'.
export const OTHER_NAME = "Other";

// hall_day() is the calendar date in hall_settings.timezone, seeded Asia/Kolkata.
// Ordinary hours are the seeded summer and winter outing clocks. The start is
// not included. The end is included. Any other time stays selectable, and the
// plan asks her to use the Permissions tab.
const HALL_ZONE = "Asia/Kolkata";
const SUMMER_START = "04-01";
const WINTER_START = "10-01";
const DAY_START = "06:30";
const SUMMER_END = "18:30";
const WINTER_END = "17:30";

const START_FUTURE = "The outing start must be in the future.";
const RETURN_FUTURE = "The expected return must be in the future.";
const RETURN_AFTER = "The expected return must be after the start.";
const SAME_DAY = "An ordinary outing starts and returns on the same hall day.";
const OUTSIDE_HOURS =
  "These hours fall outside ordinary hours. Please request permission from the Permissions tab.";

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
  onChange,
}: {
  label: string;
  shown: Date;
  value: Date | null;
  colors: HallColors;
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

  return (
    <View style={styles.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${dayText}` : `${label}, date`}
        onPress={openDate}
      >
        <Text style={[text.field, { color: ink }]}>{dayText}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${clockText}` : `${label}, time`}
        onPress={openTime}
      >
        <Text style={[text.field, { color: ink }]}>{clockText}</Text>
      </Pressable>
    </View>
  );
}

function IosWhen({
  shown,
  colors,
  onChange,
  onDismiss,
}: {
  shown: Date;
  colors: HallColors;
  onChange: (date: Date) => void;
  onDismiss?: () => void;
}) {
  return (
    <View style={styles.controls}>
      <DateTimePicker
        value={shown}
        mode="date"
        display="compact"
        accentColor={colors.forest}
        timeZoneName={HALL_ZONE}
        onDismiss={onDismiss}
        onValueChange={(_event, date) => {
          commitDay(shown, date, onChange);
        }}
      />
      <DateTimePicker
        value={shown}
        mode="time"
        display="compact"
        accentColor={colors.forest}
        timeZoneName={HALL_ZONE}
        onDismiss={onDismiss}
        onValueChange={(_event, date) => {
          commitClock(shown, date, onChange);
        }}
      />
    </View>
  );
}

export function WhenField({
  label,
  value,
  onChange,
  onAdjust,
  note,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  onAdjust?: () => void;
  note: string | null;
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
        <IosWhen shown={shown} colors={colors} onChange={change} onDismiss={onAdjust} />
      ) : (
        <AndroidWhen
          label={label}
          shown={shown}
          value={value}
          colors={colors}
          onChange={change}
        />
      )}
      {note ? <Text style={[text.error, { color: colors.danger }]}>{note}</Text> : null}
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
});
