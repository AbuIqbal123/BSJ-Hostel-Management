import { useState } from "react";
import { Redirect, router } from "expo-router";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";

import { HallButton } from "@/components/hall-button";
import { HallMark } from "@/components/hall-mark";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

// Points to shift the sign-in block up. Raise this to move it higher.
const blockLift = 47;

export default function SignInScreen() {
  const colors = useHallColors();
  const { user, signIn } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Redirect href="/signed-in" />;
  }

  async function submit() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    const message = await signIn(username, password);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace("/signed-in");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28 }}
      >
        <View style={{ flexGrow: 1, justifyContent: "center" }}>
          <View style={{ gap: 28, transform: [{ translateY: -blockLift }] }}>
            <View style={{ alignItems: "center", gap: 12 }}>
              <HallMark />
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: "SourceSerif4_600SemiBold",
                  fontSize: 28,
                  letterSpacing: -0.4,
                  textAlign: "center",
                }}
              >
                Begum Sultan Jahan Hall
              </Text>
            </View>
            <View style={{ gap: 16 }}>
              <TextField
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => {
                  void submit();
                }}
              />
              {error ? (
                <Text
                  selectable
                  style={{
                    color: colors.danger,
                    backgroundColor: colors.dangerBg,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    fontFamily: "SourceSans3_400Regular",
                    fontSize: 15,
                    padding: 12,
                  }}
                >
                  {error}
                </Text>
              ) : null}
              <HallButton
                label={pending ? "Signing in" : "Sign in"}
                disabled={pending}
                onPress={() => {
                  void submit();
                }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
