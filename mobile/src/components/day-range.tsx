import { useState } from "react";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { HALL_ZONE, formatHallDate, hallNow } from "@/format-when";
import { hallDay } from "@/outing-when";
import { useDark } from "@/theme/appearance";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export type DayRangeValue = { from: string | null; to: string | null };

function dayFromHall(on: string): Date {
  const [year, month, day] = on.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6, 30));
}

function DayChip({
  label,
  empty,
  value,
  pickerKey,
  onPick,
  onClear,
}: {
  label: string;
  empty: string;
  value: string | null;
  pickerKey: number;
  onPick: (date: Date) => void;
  onClear: () => void;
}) {
  const dark = useDark();
  const colors = useHallColors();
  const shown = value ? formatHallDate(value) : empty;
  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: value ? dayFromHall(value) : hallNow(),
      mode: "date",
      timeZoneName: HALL_ZONE,
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          onPick(date);
        }
      },
    });
  const chip =
    Platform.OS === "android" ? (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={openAndroid} style={styles.datePress}>
        <Text style={[text.field, { color: value ? colors.ink : colors.inkFaint }]}>{shown}</Text>
      </Pressable>
    ) : (
      <View style={[styles.chip, { backgroundColor: colors.chip }]}>
        <Text style={[styles.chipText, { color: colors.ink }]}>{shown}</Text>
        <DateTimePicker
          key={pickerKey}
          style={styles.chipHit}
          value={value ? dayFromHall(value) : hallNow()}
          mode="date"
          display="compact"
          accentColor={colors.forest}
          themeVariant={dark ? "dark" : "light"}
          timeZoneName={HALL_ZONE}
          onValueChange={(_event, date) => {
            if (date) {
              onPick(date);
            }
          }}
        />
      </View>
    );
  return (
    <View style={styles.bound}>
      {chip}
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          hitSlop={8}
          onPress={onClear}
          style={styles.clear}
        >
          <Text style={[styles.clearMark, { color: colors.inkSoft }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** From and to hall days, each a native date chip. A pick past the other end moves it along. */
export function DayRange({ value, onChange }: { value: DayRangeValue; onChange: (next: DayRangeValue) => void }) {
  const colors = useHallColors();
  const [keys, setKeys] = useState({ from: 0, to: 0 });
  const pick = (which: "from" | "to", date: Date) => {
    const day = hallDay(date);
    if (day === value[which]) {
      return;
    }
    const other = which === "from" ? value.to : value.from;
    const crossed = other !== null && (which === "from" ? day > other : day < other);
    onChange(which === "from" ? { from: day, to: crossed ? day : value.to } : { from: crossed ? day : value.from, to: day });
    setKeys((current) => ({ ...current, [which]: current[which] + 1 }));
  };
  return (
    <View style={styles.range}>
      <Text style={[text.body, { color: colors.inkSoft }]}>From</Text>
      <DayChip
        label="From"
        empty="Start"
        value={value.from}
        pickerKey={keys.from}
        onPick={(date) => pick("from", date)}
        onClear={() => onChange({ ...value, from: null })}
      />
      <Text style={[text.body, { color: colors.inkSoft }]}>to</Text>
      <DayChip
        label="To"
        empty="End"
        value={value.to}
        pickerKey={keys.to}
        onPick={(date) => pick("to", date)}
        onClear={() => onChange({ ...value, to: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  range: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  bound: { flexDirection: "row", alignItems: "center", gap: 4 },
  datePress: { minHeight: 44, justifyContent: "center" },
  clear: { minWidth: 28, minHeight: 44, alignItems: "center", justifyContent: "center" },
  clearMark: { fontSize: 18, lineHeight: 22 },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 8,
    minHeight: 34,
    paddingHorizontal: 11,
    justifyContent: "center",
    overflow: "hidden",
  },
  chipText: { fontFamily: "SourceSans3_400Regular", fontSize: 17, lineHeight: 22 },
  chipHit: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.02 },
});
