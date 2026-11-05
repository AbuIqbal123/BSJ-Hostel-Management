import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type SettingsRowProps = {
  label: string;
  color: string;
  onPress?: () => void;
  value?: string;
  chevron?: boolean;
};

/** One settings line: label, optional value or chevron. */
export function SettingsRow({ label, color, onPress, value, chevron = false }: SettingsRowProps) {
  const colors = useHallColors();
  const interactive = onPress !== undefined;
  return (
    <Pressable
      accessibilityRole={interactive ? "button" : "text"}
      disabled={!interactive}
      onPress={onPress}
      style={({ pressed }) => [styles.row, interactive && pressed && styles.pressed]}
    >
      <Text style={[text.button, { color }]}>{label}</Text>
      {value ? (
        <Text style={[text.body, { color: colors.inkSoft }]}>{value}</Text>
      ) : chevron ? (
        <Feather name="chevron-right" size={18} color={colors.inkFaint} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pressed: { opacity: 0.6 },
});
