import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type HallButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function HallButton({ label, onPress, disabled = false }: HallButtonProps) {
  const colors = useHallColors();
  const labelStyle = useMemo(() => [text.button, { color: colors.onForest }], [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? colors.forestDeep : colors.forest,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
  },
});
