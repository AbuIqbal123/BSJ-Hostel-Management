import { memo, useCallback, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

function droppedOneCharacter(previous: string, incoming: string): boolean {
  if (incoming.length !== previous.length - 1) {
    return false;
  }
  let index = 0;
  while (index < incoming.length && previous[index] === incoming[index]) {
    index += 1;
  }
  return previous.slice(index + 1) === incoming.slice(index);
}

// iOS redraws a secure field as an empty value. Keep an append or a one-character delete.
function securePasswordEdit(previous: string, incoming: string): string {
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  if (droppedOneCharacter(previous, incoming)) {
    return incoming;
  }
  if (incoming.length === 0) {
    return previous;
  }
  return previous + incoming;
}

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
  /** Refuses another character past this count. */
  maxLength?: number;
  /** Locked leading content inside the field. */
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
  const valueRef = useRef(value);
  valueRef.current = value;
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
  const changeText = useCallback(
    (incoming: string) => {
      if (!secureTextEntry || Platform.OS !== "ios") {
        onChangeText(incoming);
        return;
      }
      const previous = valueRef.current;
      const next = securePasswordEdit(previous, incoming);
      if (next === previous) {
        return;
      }
      valueRef.current = next;
      onChangeText(next);
    },
    [onChangeText, secureTextEntry],
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
          onChangeText={changeText}
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
