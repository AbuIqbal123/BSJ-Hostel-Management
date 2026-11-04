import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { biometricsAvailable } from "@/biometrics";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

/** Face ID / fingerprint toggle. Hidden when the phone has none enrolled. */
export function BiometricSettingsRow() {
  const colors = useHallColors();
  const { biometricReady, biometricLabel, enableBiometricSignIn, disableBiometricSignIn } =
    useSession();
  const [available, setAvailable] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void biometricsAvailable().then((ok) => {
        if (active) {
          setAvailable(ok);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!available) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${biometricLabel}, ${biometricReady ? "On" : "Off"}`}
      onPress={() => {
        if (biometricReady) {
          void disableBiometricSignIn();
          return;
        }
        void enableBiometricSignIn();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[text.button, { color: colors.ink }]}>{biometricLabel}</Text>
      <Text style={[text.body, { color: colors.inkSoft }]}>{biometricReady ? "On" : "Off"}</Text>
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
