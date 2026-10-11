import { useCallback, useRef, useState } from "react";
import { Redirect, router, useNavigation } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goBackOr } from "@/back";
import { BackMark } from "@/components/back-mark";
import { HallButton } from "@/components/hall-button";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function DeleteAccountScreen() {
  const colors = useHallColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, deleteAccount } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const back = () => goBackOr(navigation, "/settings");

  const submit = useCallback(async () => {
    if (pending.current) {
      return;
    }
    if (password.length < 1) {
      setError("Enter your password");
      return;
    }
    pending.current = true;
    setBusy(true);
    const message = await deleteAccount(password);
    pending.current = false;
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace("/sign-in");
  }, [deleteAccount, password]);

  const ask = useCallback(() => {
    if (pending.current) {
      return;
    }
    if (password.length < 1) {
      setError("Enter your password");
      return;
    }
    Alert.alert("Delete account", "Are you sure you want to delete?", [
      { text: "Back", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void submit();
        },
      },
    ]);
  }, [password.length, submit]);

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
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <BackMark color={colors.inkSoft} />
      </Pressable>
      <Text style={[text.hallName, styles.title, { color: colors.ink }]}>Delete account</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>
        This signs you out and removes your name, phone, and hall pass. The hall keeps the record
        of outings it already has, without your name. Enter your password to confirm.
      </Text>
      <TextField
        label="Password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={ask}
      />
      <HallButton
        label={busy ? "Deleting account" : "Delete account"}
        disabled={busy || password.length < 1}
        onPress={ask}
      />
      {error ? (
        <Text selectable style={[text.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
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
  back: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  title: { textAlign: "left" },
});
