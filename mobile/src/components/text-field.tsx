import { Text, TextInput, View } from "react-native";

import { useHallColors } from "@/theme/colors";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences";
  autoComplete?: "username" | "password" | "off";
  textContentType?: "username" | "password";
  returnKeyType?: "next" | "go";
  onSubmitEditing?: () => void;
};

export function TextField({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = "none",
  autoComplete = "off",
  textContentType,
  returnKeyType = "next",
  onSubmitEditing,
}: TextFieldProps) {
  const colors = useHallColors();

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.inkSoft,
          fontFamily: "SourceSans3_600SemiBold",
          fontSize: 15,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        placeholder={label}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={label}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: 12,
          borderCurve: "continuous",
          color: colors.ink,
          fontFamily: "SourceSans3_400Regular",
          fontSize: 17,
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      />
    </View>
  );
}
