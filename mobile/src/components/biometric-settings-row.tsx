import { Alert, Platform } from "react-native";

import { SettingsRow } from "@/components/settings-row";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";

/**
 * Face ID / fingerprint for sign-in after sign-out.
 * Always listed on a phone build so Settings shows the control.
 */
export function BiometricSettingsRow() {
  const colors = useHallColors();
  const { biometricReady, biometricLabel, enableBiometricSignIn, disableBiometricSignIn } =
    useSession();

  if (Platform.OS === "web") {
    return null;
  }

  const label = `Sign in with ${biometricLabel}`;

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
        void enableBiometricSignIn().then((message) => {
          if (message) {
            Alert.alert(message);
          }
        });
      }}
    />
  );
}
