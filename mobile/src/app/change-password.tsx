import { useCallback, useRef, useState } from "react";
import { Redirect, router, useNavigation } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { PASSWORD_RULES, passwordRulesMet } from "@/password-rules";
import { text } from "@/theme/text";

export default function ChangePasswordScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, changePassword } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const submit = useCallback(async () => {
    if (pending.current) {
      return;
    }
    if (currentPassword.length < 1) {
      setError("Enter your current password");
      return;
    }
    if (newPassword.length > 200) {
      setError("Use 200 characters or fewer");
      return;
    }
    if (!passwordRulesMet(newPassword)) {
      return;
    }
    pending.current = true;
    const message = await changePassword(currentPassword, newPassword);
    pending.current = false;
    if (message) {
      setError(message);
      return;
    }
    router.replace("/sign-in");
  }, [changePassword, currentPassword, newPassword]);

  const back = () => goBackOr(navigation, user?.role === "resident" ? "/settings" : "/staff/settings");

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={back}
        style={styles.back}
      >
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Change password</Text>
      <View style={styles.fields}>
        <TextField
          label="Current password"
          value={currentPassword}
          onChangeText={(value) => {
            setCurrentPassword(value);
            setError(null);
          }}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="next"
        />
        <View style={styles.passwordBlock}>
          <TextField
            label="New password"
            value={newPassword}
            onChangeText={(value) => {
              setNewPassword(value);
              setError(null);
            }}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => {
              void submit();
            }}
          />
          {newPassword.length > 0 && PASSWORD_RULES.some((rule) => !rule.test(newPassword)) ? (
            <View style={styles.rules}>
              {PASSWORD_RULES.filter((rule) => !rule.test(newPassword)).map((rule) => (
                <Text key={rule.label} style={[text.error, { color: colors.inkSoft }]}>
                  {rule.label}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        <View>
          <HallButton label="Change password" disabled={!passwordRulesMet(newPassword)} onPress={() => void submit()} />
          <View
            pointerEvents="none"
            accessibilityElementsHidden={error === null}
            style={styles.errorSlot}
          >
            <Text
              selectable={error !== null}
              style={[
                text.error,
                styles.error,
                {
                  color: colors.danger,
                  backgroundColor: colors.dangerBg,
                  opacity: error ? 1 : 0,
                },
              ]}
            >
              {error ?? " "}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 28,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: -6,
  },
  title: { textAlign: "left" },
  fields: { gap: 16 },
  passwordBlock: { gap: 8 },
  rules: { gap: 2 },
  errorSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 12,
  },
  error: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 12,
  },
});
