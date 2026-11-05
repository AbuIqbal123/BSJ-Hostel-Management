import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * Settings footer so a phone can prove which JS bundle is running.
 * After an OTA, the short id changes; embedded builds show "embedded".
 */
export function hallBundleLabel(): string {
  const version = Constants.expoConfig?.version ?? "1.0.0";
  if (__DEV__ || !Updates.isEnabled) {
    return `Version ${version}`;
  }
  const id = Updates.updateId?.replace(/-/g, "").slice(0, 8) ?? "embedded";
  return `Version ${version} · ${id}`;
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
