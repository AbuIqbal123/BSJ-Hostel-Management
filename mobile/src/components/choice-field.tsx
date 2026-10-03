import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type HallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export type Choice = {
  id: string;
  label: string;
};

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

export const ChoiceField = memo(function ChoiceField({
  label,
  valueLabel,
  items,
  selectedId,
  onPick,
  colors,
  openShowsAll,
  note,
  hint,
  placeholder,
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
  placeholder?: string;
}) {
  const blank = placeholder ?? label;
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
            placeholder={blank}
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
          accessibilityLabel={valueLabel ? `${label}, ${valueLabel}` : blank}
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
            {valueLabel ?? blank}
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
});

const styles = StyleSheet.create({
  noteBlock: { gap: 8 },
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
});

