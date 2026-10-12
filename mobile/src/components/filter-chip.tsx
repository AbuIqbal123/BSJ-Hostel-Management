import { Pressable, StyleSheet, Text } from "react-native";

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
});
