import { useCallback, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function ChangePasswordScreen() {
  const colors = useHallColors();
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
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (newPassword.length > 200) {
      setError("Use 200 characters or fewer.");
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

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
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
        <View>
          <HallButton label="Change password" onPress={() => void submit()} />
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
    paddingTop: 28,
    paddingBottom: 28,
  },
  fields: { gap: 16 },
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
