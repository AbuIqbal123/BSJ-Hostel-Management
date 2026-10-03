import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  const blank = placeholder ?? label;
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
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
    },
    [onPick],
  );

  return (
    <View style={styles.noteBlock}>
      <Text style={[text.label, { color: colors.inkSoft }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={valueLabel ? `${label}, ${valueLabel}` : blank}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
        }}
        style={[
          styles.shell,
          styles.shellPad,
          {
            backgroundColor: colors.surface,
            borderColor: open ? colors.forest : colors.line,
          },
        ]}
      >
        <Text style={[text.field, { color: valueLabel ? colors.ink : colors.inkFaint }]}>
          {valueLabel ?? blank}
        </Text>
      </Pressable>
      {open ? (
        <OptionList items={items} selectedId={selectedId} onPick={pick} colors={colors} />
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
    justifyContent: "center",
  },
  shellPad: { paddingHorizontal: 14 },
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
