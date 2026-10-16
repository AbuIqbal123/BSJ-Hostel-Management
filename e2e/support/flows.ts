import { credentials, expect, type App, type Screen } from 'e2e';
import type { Device } from '@e2e-dev/mobile';

type Who = 'resident' | 'gate' | 'warden';

/** A fresh launch with no stored session: the app opens on Sign in. */
export async function freshLaunch(app: App, device: Device, screen: Screen) {
  // The session token lives in the keychain (expo-secure-store), which clearState leaves alone.
  await device.clearKeychain();
  await app.clearState();
  await app.open();
  await expect(screen.getByRole('button', 'Sign in')).toBeVisible({ timeout: 60_000 });
}

export async function signIn(screen: Screen, who: Who) {
  const account = credentials.user(who);
  await screen.getByLabel('Username').fill(account.username);
  await screen.getByLabel('Password').fill(account.password);
  await screen.getByRole('button', 'Sign in').tap();
}

/**
 * Ordinary hours end at 6:30 PM in summer and 5:30 PM in winter.
 * 10:00 AM to 4:00 PM is inside both, so the plan does not depend on the date.
 */
export const ordinaryOuting = { leave: "10:00 AM", back: "4:00 PM" };

/** Tabs carry `tab-<route>` test ids (resident: home, pass, permissions, settings; staff: index, scan, requests, settings). */
export function tab(screen: Screen, route: string) {
  return screen.getByTestId(`tab-${route}`);
}
