import { memo, useCallback, useMemo, useState, type Ref } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences";
  autoComplete?: "username" | "password" | "off";
  textContentType?: "username" | "password";
  returnKeyType?: "next" | "go";
  submitBehavior?: "submit" | "blurAndSubmit";
  autoFocus?: boolean;
  inputRef?: Ref<TextInput>;
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

export const TextField = memo(function TextField({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = "none",
  autoComplete = "off",
  textContentType,
  returnKeyType = "next",
  submitBehavior = "blurAndSubmit",
  autoFocus = false,
  inputRef,
  onSubmitEditing,
  onFocus,
  onBlur,
}: TextFieldProps) {
  const colors = useHallColors();
  const [focused, setFocused] = useState(false);
  const labelStyle = useMemo(() => [text.label, { color: colors.inkSoft }], [colors]);
  const inputStyle = useMemo(() => [styles.input, text.field, { color: colors.ink }], [colors]);
  const shellStyle = useMemo(
    () => [
      styles.shell,
      { backgroundColor: colors.surface, borderColor: focused ? colors.forest : colors.line },
    ],
    [colors, focused],
  );
  const showFocus = useCallback(() => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);
  const hideFocus = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  return (
    <View style={styles.field}>
      <Text style={labelStyle}>{label}</Text>
      <View style={shellStyle}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          spellCheck={false}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onFocus={showFocus}
          onBlur={hideFocus}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          submitBehavior={submitBehavior}
          onSubmitEditing={onSubmitEditing}
          placeholder={label}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.forest}
          cursorColor={colors.forest}
          accessibilityLabel={label}
          style={inputStyle}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 8 },
  shell: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  input: {
    height: "100%",
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
});
