import { useEffect, useState } from "react";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { formatWhen, utcInstant } from "@/format-when";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

// Seeded catalog name. backend/app/shared/migrations/0001_create_hall.sql stores 'Other'.
export const OTHER_NAME = "Other";

// hall_day() is the calendar date in hall_settings.timezone, seeded Asia/Kolkata.
// Ordinary hours are the seeded summer and winter outing clocks. The start is
// not included. The end is included. A later time is not a permission flow.
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
const START_EARLY = "That start is outside ordinary hours.";
const START_LATE = "That start is outside ordinary hours. Please submit a permission request.";
const RETURN_EARLY = "That return is outside ordinary hours.";
const RETURN_LATE = "That return is outside ordinary hours. Please submit a permission request.";

function hallPart(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALL_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return parts.find((item) => item.type === type)?.value ?? "";
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

function hoursNote(date: Date, kind: "start" | "return"): string | null {
  const day = monthDay(date);
  const summer = SUMMER_START <= day && day < WINTER_START;
  const end = summer ? SUMMER_END : WINTER_END;
  const clock = hallClock(date);
  if (clock <= `${DAY_START}:00`) {
    return kind === "start" ? START_EARLY : RETURN_EARLY;
  }
  if (clock > `${end}:00`) {
    return kind === "start" ? START_LATE : RETURN_LATE;
  }
  return null;
}

export function leaveNote(leaveAt: Date | null): string | null {
  if (!leaveAt) {
    return null;
  }
  if (leaveAt.getTime() <= Date.now()) {
    return START_FUTURE;
  }
  return hoursNote(leaveAt, "start");
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
  return hoursNote(backBy, "return");
}

export function WhenField({
  label,
  value,
  onChange,
  pastNote,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  pastNote: string | null;
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
          if (!date) {
            return;
          }
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            onValueChange: (_timeEvent, time) => {
              if (!time) {
                return;
              }
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
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      {showPicker ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="datetime"
          display="compact"
          onValueChange={(_event, date) => {
            if (date) {
              onChange(date);
            }
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}, ${formatWhen(utcInstant(value))}` : label}
          onPress={open}
          style={[
            styles.shell,
            styles.shellPad,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Text style={[text.field, { color: value ? colors.ink : colors.inkFaint }]}>
            {value ? formatWhen(utcInstant(value)) : label}
          </Text>
        </Pressable>
      )}
      {pastNote ? <Text style={[text.error, { color: colors.danger }]}>{pastNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  shell: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    justifyContent: "center",
  },
  shellPad: { paddingHorizontal: 14 },
});
