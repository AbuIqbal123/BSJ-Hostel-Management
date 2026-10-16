import { useMemo } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type HallButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Inline progress. The button stays in place and ignores presses. */
  busy?: boolean;
};

export function HallButton({ label, onPress, disabled = false, busy = false }: HallButtonProps) {
  const colors = useHallColors();
  const held = disabled || busy;
  const labelStyle = useMemo(() => [text.button, { color: colors.onForest }], [colors]);
  const ripple = useMemo(
    () => (Platform.OS === "android" ? { color: colors.forestDeep } : undefined),
    [colors],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: held, busy }}
      disabled={held}
      onPress={onPress}
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? colors.forestDeep : colors.forest,
          opacity: held ? 0.6 : 1,
          transform: [{ scale: pressed && !held ? 0.98 : 1 }],
        },
      ]}
    >
      {busy ? <ActivityIndicator color={colors.onForest} /> : <Text style={labelStyle}>{label}</Text>}
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
