import { credentials, expect, type App, type Locator, type Screen } from 'e2e';
import type { Device } from '@e2e-dev/mobile';

type Who = 'resident' | 'gate' | 'warden';

/** A fresh launch with no stored session: the app opens on Sign in. */
export async function freshLaunch(app: App, device: Device, screen: Screen) {
  // The session token lives in the keychain (expo-secure-store), which clearState leaves alone.
  await device.clearKeychain();
  await app.clearState();
  await app.open();
  await expect(screen.getByRole('button', 'Sign in')).toBeVisible({ timeout: 60_000 });
  // The splash stays in the tree after Sign in is visible. Typing through it
  // remounts the field and the runner rejects the value.
  await expect(screen.getByText('Begum Sultan Jahan Hall, loading')).toBeHidden({ timeout: 20_000 });
}

export async function signIn(screen: Screen, who: Who) {
  const account = credentials.user(who);
  await signInWith(screen, account.username, account.password);
}

export async function signInWith(
  screen: Screen,
  username: string,
  password: Parameters<Locator['fill']>[0],
) {
  // The caption and the field both expose the label, so the role picks the field.
  // A fill that starts while the form is sliding can disagree with what it reads back.
  await fillField(screen.getByRole('textbox', 'Username'), username);
  await fillField(screen.getByRole('textbox', 'Password'), password);
  await screen.getByRole('button', 'Sign in').tap();
  await dismissSavePassword(screen);
}

async function fillField(field: Locator, value: Parameters<Locator['fill']>[0]) {
  await field.tap();
  try {
    await field.fill(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('read-back did not match')) {
      throw error;
    }
    await field.fill(value);
  }
}

/** iOS covers the hall with a Safari "Save Password?" sheet after a sign-in. */
export async function dismissSavePassword(screen: Screen) {
  const notNow = screen.getByRole('button', 'Not Now');
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await notNow.isVisible()) {
      await notNow.tap();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
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
