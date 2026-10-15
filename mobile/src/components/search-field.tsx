import { Feather } from "@expo/vector-icons";
import { StyleSheet, TextInput, View } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export function SearchField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const colors = useHallColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Feather name="search" size={16} color={colors.inkFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[text.field, styles.input, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, height: "100%", paddingVertical: 0 },
});
