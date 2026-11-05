import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";

import { biometricsAvailable } from "@/biometrics";
import { SettingsRow } from "@/components/settings-row";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

/**
 * Face ID / fingerprint for sign-in after sign-out.
 * Hidden on web. On a phone with no biometrics enrolled, shows Unavailable.
 */
export function BiometricSettingsRow() {
  const colors = useHallColors();
  const { biometricReady, biometricLabel, enableBiometricSignIn, disableBiometricSignIn } =
    useSession();
  const [available, setAvailable] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") {
        setAvailable(false);
        return;
      }
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

  if (Platform.OS === "web" || available === null) {
    return null;
  }

  const label = `Sign in with ${biometricLabel}`;

  if (!available) {
    return <SettingsRow label={label} color={colors.inkSoft} value="Unavailable" />;
  }

  return (
    <SettingsRow
      label={label}
      color={colors.ink}
      value={biometricReady ? "On" : "Off"}
      onPress={() => {
        if (biometricReady) {
          void disableBiometricSignIn();
          return;
        }
        void enableBiometricSignIn();
      }}
    />
  );
}
