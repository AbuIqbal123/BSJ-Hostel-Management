/**
 * Face ID / fingerprint as an optional sign-in on the phone.
 * A stored session still opens the shell without a biometric gate.
 * Hides expo-local-authentication and SecureStore behind one surface.
 */

import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import { ignore } from "@/safe";

const PREF_KEY = "bsj.biometric.sign-in";
const CRED_KEY = "bsj.biometric.credentials";
/** Earlier builds stored the preference under this key. */
const LEGACY_PREF_KEY = "bsj.biometric.unlock";

export type BiometricCredentials = { username: string; password: string };

/** Human label for the device's biometrics. */
export function biometricLabelFor(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }
  return "Biometrics";
}

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }
  const hardware = await LocalAuthentication.hasHardwareAsync();
  if (!hardware) {
    return false;
  }
  return LocalAuthentication.isEnrolledAsync();
}

export async function biometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return biometricLabelFor(types);
}

export async function confirmBiometrics(prompt: string): Promise<boolean> {
  if (!(await biometricsAvailable())) {
    return false;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function biometricSignInEnabled(): Promise<boolean> {
  try {
    const current = await SecureStore.getItemAsync(PREF_KEY);
    if (current === "1") {
      return true;
    }
    const legacy = await SecureStore.getItemAsync(LEGACY_PREF_KEY);
    if (legacy === "1") {
      await SecureStore.setItemAsync(PREF_KEY, "1");
      try {
        await SecureStore.deleteItemAsync(LEGACY_PREF_KEY);
      } catch {
        ignore();
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function setBiometricSignInEnabled(on: boolean): Promise<void> {
  if (on) {
    await SecureStore.setItemAsync(PREF_KEY, "1");
    return;
  }
  for (const key of [PREF_KEY, LEGACY_PREF_KEY]) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      ignore();
    }
  }
}

export async function saveBiometricCredentials(credentials: BiometricCredentials): Promise<void> {
  await SecureStore.setItemAsync(
    CRED_KEY,
    JSON.stringify({
      username: credentials.username.trim(),
      password: credentials.password,
    }),
  );
}

export async function readBiometricCredentials(): Promise<BiometricCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(CRED_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<BiometricCredentials>;
    if (typeof parsed.username !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    if (!parsed.username.trim() || !parsed.password) {
      return null;
    }
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CRED_KEY);
  } catch {
    ignore();
  }
}

/** Preference off and saved password cleared. */
export async function clearBiometricSignIn(): Promise<void> {
  await setBiometricSignInEnabled(false);
  await clearBiometricCredentials();
}

/** Preference on and credentials saved — sign-in can offer Face ID / fingerprint. */
export async function biometricSignInReady(): Promise<boolean> {
  if (!(await biometricSignInEnabled())) {
    return false;
  }
  if (!(await biometricsAvailable())) {
    return false;
  }
  return (await readBiometricCredentials()) !== null;
}
