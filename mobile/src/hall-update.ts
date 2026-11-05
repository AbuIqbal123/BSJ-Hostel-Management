import Constants from "expo-constants";
import * as Updates from "expo-updates";

/** Settings footer: the app version only. OTA ids stay in Expo, not on the phone. */
export function hallBundleLabel(): string {
  const version = Constants.expoConfig?.version ?? "1.0.0";
  return `Version ${version}`;
}

/**
 * Same pattern as ICACON: check → fetch → reload on launch so an OTA does not
 * wait for a second cold start. Failures keep the current bundle.
 */
export async function applyHallUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) {
    return;
  }
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) {
    return;
  }
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
