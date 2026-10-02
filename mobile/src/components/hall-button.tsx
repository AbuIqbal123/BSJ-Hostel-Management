import { Pressable, Text } from "react-native";

import { useHallColors } from "@/theme/colors";

type HallButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function HallButton({ label, onPress, disabled = false }: HallButtonProps) {
  const colors = useHallColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.forestDeep : colors.forest,
        borderRadius: 12,
        borderCurve: "continuous",
        opacity: disabled ? 0.6 : 1,
        paddingVertical: 14,
        alignItems: "center",
      })}
    >
      <Text
        style={{
          color: colors.onForest,
          fontFamily: "SourceSans3_600SemiBold",
          fontSize: 17,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
