import { memo, useCallback, useMemo, useState, type ReactNode, type Ref } from "react";
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
  /** When false, keep the idle border even while focused (e.g. during raise). */
  showOutline?: boolean;
  keyboardType?: "default" | "number-pad";
  /** Refuses another character past this count. Sign-in does not use this. */
  maxLength?: number;
  /** Locked leading content inside the field. Sign-in does not use this. */
  prefix?: ReactNode;
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
  showOutline = true,
  keyboardType,
  maxLength,
  prefix,
}: TextFieldProps) {
  const colors = useHallColors();
  const [focused, setFocused] = useState(false);
  const labelStyle = useMemo(() => [text.label, { color: colors.inkSoft }], [colors]);
  const inputStyle = useMemo(
    () => [
      styles.input,
      prefix ? styles.inputFill : styles.inputPad,
      text.field,
      { color: colors.ink },
    ],
    [colors, prefix],
  );
  const painted = focused && showOutline;
  const shellStyle = useMemo(
    () => [
      styles.shell,
      prefix ? styles.shellRow : null,
      { backgroundColor: colors.surface, borderColor: painted ? colors.forest : colors.line },
    ],
    [colors, painted, prefix],
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
        {prefix}
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
          keyboardType={keyboardType}
          maxLength={maxLength}
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
  shellRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    height: "100%",
    paddingVertical: 0,
  },
  inputPad: {
    paddingHorizontal: 14,
  },
  inputFill: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 8,
    paddingRight: 14,
  },
});
