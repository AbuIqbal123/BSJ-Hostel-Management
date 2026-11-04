/**
 * Phone key-value store. Hides expo-secure-store so session, appearance,
 * and biometrics share one seam.
 */

import * as SecureStore from "expo-secure-store";

export async function phoneGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function phoneSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function phoneDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
