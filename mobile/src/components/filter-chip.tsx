import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHallColors } from "@/theme/colors";

export function FilterChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[
        styles.chip,
        on
          ? { borderColor: colors.forest, backgroundColor: colors.approvedBg }
          : { borderColor: colors.line, backgroundColor: colors.surface },
      ]}
    >
      <Text numberOfLines={1} style={[styles.label, { color: on ? colors.forest : colors.inkSoft }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Selected tab: forest word and a forest underline. The row stays in the filter line. */
export function FilterMark({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const colors = useHallColors();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={styles.markHit}
    >
      <Text numberOfLines={1} style={[styles.markLabel, { color: on ? colors.forest : colors.inkSoft }]}>
        {label}
      </Text>
      <View style={[styles.mark, { backgroundColor: on ? colors.forest : "transparent" }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  label: { fontFamily: "SourceSans3_600SemiBold", fontSize: 15, lineHeight: 20 },
  markHit: { minHeight: 32, justifyContent: "flex-end", gap: 6 },
  markLabel: { fontFamily: "SourceSans3_600SemiBold", fontSize: 15, lineHeight: 20 },
  mark: { height: 2, borderRadius: 1 },
});
