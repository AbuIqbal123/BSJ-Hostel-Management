import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

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
  const ripple = useMemo(
    () => (Platform.OS === "android" ? { color: colors.forestDeep } : undefined),
    [colors],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? colors.forestDeep : colors.forest,
          opacity: disabled ? 0.6 : 1,
          // Design §6: button press scale 0.98 (transform stays on the compositor).
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
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
    overflow: "hidden",
    paddingVertical: 14,
  },
});
