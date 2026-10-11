import { Feather } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { type HallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export type Choice = {
  id: string;
  label: string;
};

type Closer = () => void;

let closeOpen: Closer | null = null;

export function dismissOpenChoice(): boolean {
  if (closeOpen === null) {
    return false;
  }
  closeOpen();
  return true;
}

function bindOpen(close: Closer) {
  if (closeOpen && closeOpen !== close) {
    closeOpen();
  }
  closeOpen = close;
}

function unbindOpen(close: Closer) {
  if (closeOpen === close) {
    closeOpen = null;
  }
}

function matches(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return label.toLowerCase().includes(needle);
}

function OptionList({
  label,
  items,
  selectedId,
  query,
  onQuery,
  onPick,
  colors,
}: {
  label: string;
  items: Choice[];
  selectedId: string | null;
  query: string;
  onQuery: (value: string) => void;
  onPick: (id: string) => void;
  colors: HallColors;
}) {
  const shown = useMemo(() => items.filter((item) => matches(item.label, query)), [items, query]);
  return (
    <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.forest }]}>
      <TextInput
        accessibilityLabel={`Search ${label}`}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        placeholder="Search"
        placeholderTextColor={colors.inkFaint}
        value={query}
        onChangeText={onQuery}
        style={[styles.search, text.field, { color: colors.ink, borderColor: colors.line }]}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={styles.menuScroll}
      >
        {shown.length === 0 ? (
          <Text style={[text.body, styles.empty, { color: colors.inkSoft }]}>No matches</Text>
        ) : (
          shown.map((item, index) => {
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
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line } : null,
                  { backgroundColor: selected ? colors.approvedBg : colors.surface },
                ]}
              >
                <Text style={[text.field, styles.optionLabel, { color: selected ? colors.forest : colors.ink }]}>
                  {item.label}
                </Text>
                {selected ? <Feather name="check" size={18} color={colors.forest} /> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
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
  note: string | null;
  hint?: string | null;
  placeholder?: string;
}) {
  const blank = placeholder ?? "Choose";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) {
      unbindOpen(close);
      return;
    }
    bindOpen(close);
    return () => {
      unbindOpen(close);
    };
  }, [close, open]);

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={valueLabel ? `${label}, ${valueLabel}` : `${label}, ${blank}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
          setQuery("");
        }}
        style={[
          styles.shell,
          {
            backgroundColor: colors.surface,
            borderColor: open ? colors.forest : colors.line,
          },
        ]}
      >
        <Text style={[text.field, styles.value, { color: valueLabel ? colors.ink : colors.inkFaint }]}>
          {valueLabel ?? blank}
        </Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.forest} />
      </Pressable>
      {open && items.length > 0 ? (
        <OptionList
          label={label}
          items={items}
          selectedId={selectedId}
          query={query}
          onQuery={setQuery}
          onPick={pick}
          colors={colors}
        />
      ) : null}
      {hint ? <Text style={[text.body, { color: colors.inkSoft }]}>{hint}</Text> : null}
      {note ? <Text style={[text.error, { color: colors.danger }]}>{note}</Text> : null}
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
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  value: { flex: 1 },
  menu: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  search: {
    height: 48,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuScroll: { maxHeight: 240 },
  option: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionLabel: { flex: 1 },
  empty: { paddingHorizontal: 14, paddingVertical: 14 },
});
