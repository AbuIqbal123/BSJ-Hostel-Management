import { useCallback, useEffect, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { dismissOpenChoice } from "@/components/choice-field";
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
const START_HOURS = "That start is outside ordinary hours.";
const RETURN_HOURS = "That return is outside ordinary hours.";

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

function wallUtc(date: Date): number {
  return new Date(
    `${hallDay(date)}T${hallPart(date, "hour")}:${hallPart(date, "minute")}:${hallPart(date, "second")}Z`,
  ).getTime();
}

function proposalWhen(): Date {
  const hour = Number(DAY_START.slice(0, 2)) + 1;
  const day = hallDay(new Date());
  const [year, month, date] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, date, hour, 0, 0));
  return new Date(guess.getTime() - (wallUtc(guess) - guess.getTime()));
}

function hoursNote(date: Date, kind: "start" | "return"): string | null {
  const day = monthDay(date);
  const summer = SUMMER_START <= day && day < WINTER_START;
  const end = summer ? SUMMER_END : WINTER_END;
  const clock = hallClock(date);
  if (clock <= `${DAY_START}:00` || clock > `${end}:00`) {
    return kind === "start" ? START_HOURS : RETURN_HOURS;
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

type Closer = () => void;

let closeOpenWhen: Closer | null = null;

export function dismissOpenWhen(): boolean {
  if (closeOpenWhen === null) {
    return false;
  }
  closeOpenWhen();
  return true;
}

function bindOpenWhen(close: Closer) {
  if (closeOpenWhen && closeOpenWhen !== close) {
    closeOpenWhen();
  }
  closeOpenWhen = close;
}

function unbindOpenWhen(close: Closer) {
  if (closeOpenWhen === close) {
    closeOpenWhen = null;
  }
}

export function useOneOpen(open: boolean, close: Closer) {
  useEffect(() => {
    if (!open) {
      unbindOpenWhen(close);
      return;
    }
    dismissOpenChoice();
    bindOpenWhen(close);
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => {
      subscription.remove();
      unbindOpenWhen(close);
    };
  }, [close, open]);
}

function sameHallMinute(left: Date, right: Date): boolean {
  return (
    hallDay(left) === hallDay(right) &&
    hallPart(left, "hour") === hallPart(right, "hour") &&
    hallPart(left, "minute") === hallPart(right, "minute")
  );
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
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useOneOpen(open, close);

  const shown = value ?? proposalWhen();
  const printed = formatWhen(utcInstant(shown));
  const comma = printed.lastIndexOf(", ");
  const dayText = comma === -1 ? printed : printed.slice(0, comma);
  const clockText = comma === -1 ? "" : printed.slice(comma + 2);
  const ink = value ? colors.ink : colors.inkFaint;
  const offset = Math.round((wallUtc(shown) - shown.getTime()) / 60000);

  const commit = (date: Date) => {
    if (sameHallMinute(date, shown)) {
      return;
    }
    onChange(date);
  };

  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={value ? `${label}, ${dayText} ${clockText}` : label}
        onPress={() => {
          setOpen((current) => !current);
        }}
        style={styles.row}
      >
        <Text style={[text.label, { color: open ? colors.forest : colors.inkSoft }]}>{label}</Text>
        <Text style={[text.field, { color: ink }]}>{dayText}</Text>
        <Text style={[text.field, { color: ink }]}>{clockText}</Text>
      </Pressable>
      {open ? (
        <View onStartShouldSetResponder={() => true}>
          {Platform.OS === "android" ? (
            <View>
              <DateTimePicker
                value={shown}
                mode="date"
                display="spinner"
                timeZoneName={HALL_ZONE}
                onValueChange={(_event, date) => {
                  commit(date);
                }}
              />
              <DateTimePicker
                value={shown}
                mode="time"
                display="spinner"
                timeZoneName={HALL_ZONE}
                onValueChange={(_event, date) => {
                  commit(date);
                }}
              />
            </View>
          ) : (
            <DateTimePicker
              value={shown}
              mode="datetime"
              display="spinner"
              timeZoneName={HALL_ZONE}
              timeZoneOffsetInMinutes={offset}
              onValueChange={(_event, date) => {
                commit(date);
              }}
            />
          )}
        </View>
      ) : null}
      {value && pastNote ? (
        <Text style={[text.error, { color: colors.danger }]}>{pastNote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
