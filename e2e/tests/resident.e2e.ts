import { beforeEach, describe, test } from '@e2e-dev/mobile';
import { credentials, expect, secrets, type Screen } from 'e2e';

import { freshLaunch, ordinaryOuting, signIn, signInWith, tab } from '../support/flows.ts';
import { holdHallDatabase, seedGuestTabs, seedHistoryPages } from '../support/hall.ts';

describe('resident', { tags: ['resident'] }, () => {
  beforeEach(async ({ app, device, screen }) => {
    await freshLaunch(app, device, screen);
    await signIn(screen, 'resident');
    await expect(tab(screen, 'home')).toBeVisible({ timeout: 30_000 });
  });

  test('signs in to Home', async ({ screen }) => {
    // The home pressable groups its children, so these words are one accessible name.
    await expect(screen.getByText(/Plan an outing/)).toBeVisible();
    await expect(screen.getByText(/Notifications/)).toBeVisible();
  });

  test('hall pass tab shows the pass state', async ({ screen }) => {
    await tab(screen, 'pass').tap();
    // A fresh hall has no outing, so there is no live pass yet.
    await expect(screen.getByText(/No pass right now|You have a planned outing/)).toBeVisible();
  });

  test('permissions lists the three request kinds', async ({ screen }) => {
    await tab(screen, 'permissions').tap();
    // The empty list repeats the selected kind, so the row at the top is the one to open.
    const lateNight = screen.getByRole('button', 'Request late-night').first();
    await expect(lateNight).toBeVisible();
    await expect(screen.getByRole('button', 'Request home going')).toBeVisible();
    await expect(screen.getByRole('button', 'Request guest stay')).toBeVisible();
    await lateNight.tap();
    await expect(screen.getByRole('button', 'Back')).toBeVisible();
  });

  test('plans an ordinary outing', async ({ screen }) => {
    // Home groups Place, the chips, and Confirm into one name, so those taps are
    // points on the iPhone 17 Home layout (402 by 874). The calendar is a real
    // day button. The clocks open as wheels, starting at 7:00 AM.
    await screen.tapAt({ x: 201, y: 293 });
    await screen.tapAt({ x: 201, y: 447 });
    await screen.tapAt({ x: 80, y: 381 });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    try {
      await screen.getByRole('button', day).tap({ timeout: 4_000 });
    } catch {
      await screen.getByRole('button', 'Next Month').tap();
      await screen.getByRole('button', day).tap();
    }
    await setClock(screen, { x: 183, y: 381 }, ordinaryOuting.leave);
    await expect(screen.getByText(new RegExp(ordinaryOuting.leave))).toBeVisible();
    await setClock(screen, { x: 183, y: 461 }, ordinaryOuting.back);
    await expect(screen.getByText(new RegExp(ordinaryOuting.back))).toBeVisible();
    // Dismissing a wheel holds Confirm for a moment. Then it is back at its point.
    await new Promise((resolve) => setTimeout(resolve, 800));
    await screen.tapAt({ x: 58, y: 509 });
    await expect(screen.getByText(/Upcoming outings/)).toBeVisible({ timeout: 15_000 });
    await expect(screen.getByText(/Maulana Azad Library/)).toBeVisible();
  });

  test('settings opens Change password', async ({ screen }) => {
    await tab(screen, 'settings').tap();
    await expect(screen.getByRole('button', 'Sign out')).toBeVisible();
    await screen.getByRole('button', /^Change password/).tap();
    await expect(screen.getByRole('textbox', 'Current password')).toBeVisible();
    await expect(screen.getByRole('button', 'Change password')).toBeDisabled();
  });

  test('history pages a long list', async ({ screen }) => {
    await seedHistoryPages();
    await tab(screen, 'settings').tap();
    await screen.getByRole('button', /^History/).tap();
    await expect(screen.getByText('History')).toBeVisible();
    await expect(screen.getByText('Page 51')).toBeVisible({ timeout: 20_000 });
    await expect(screen.getByText('Page 01')).toHaveCount(0);
    await screen.getByRole('button', 'Show older').tap();
    await expect(screen.getByText('Page 01')).toBeVisible({ timeout: 20_000 });
  });

  test('a failed history list retries', async ({ screen }) => {
    await tab(screen, 'settings').tap();
    const held = await holdHallDatabase();
    try {
      await screen.getByRole('button', /^History/).tap();
      await expect(screen.getByText("History didn't load")).toBeVisible({ timeout: 20_000 });
      await expect(screen.getByRole('button', 'Retry')).toBeVisible();
    } finally {
      held.release();
    }
    await screen.getByRole('button', 'Retry').tap();
    await expect(screen.getByText("History didn't load")).toBeHidden({ timeout: 20_000 });
    await expect(screen.getByText(/No history|Page \d+/)).toBeVisible();
  });

  test('guest stays show upcoming first, then older', async ({ screen }) => {
    const guests = await seedGuestTabs();
    await tab(screen, 'permissions').tap();
    await screen.getByText('Guest stays').tap();
    await expect(screen.getByText(guests.upcoming)).toBeVisible({ timeout: 20_000 });
    await expect(screen.getByText(guests.older)).toHaveCount(0);
    await screen.getByRole('button', 'Show older').tap();
    await expect(screen.getByText('Older')).toBeVisible({ timeout: 20_000 });
    await expect(screen.getByText(guests.older)).toBeVisible();
    await expect(screen.getByText(guests.upcoming)).toBeVisible();
  });

  // Last: it changes the resident's password. The next run reseeds a fresh hall.
  test('changes the password and signs in with the new one', async ({ screen }) => {
    await tab(screen, 'settings').tap();
    await screen.getByRole('button', /^Change password/).tap();
    await screen.getByRole('textbox', 'Current password').fill(credentials.user('resident').password);
    await screen.getByRole('textbox', 'New password').fill(secrets.get('resident-new-password'));
    await screen.getByRole('button', 'Change password').tap();
    await expect(screen.getByRole('button', 'Sign in')).toBeVisible({ timeout: 15_000 });
    await signInWith(
      screen,
      credentials.user('resident').username,
      secrets.get('resident-new-password'),
    );
    await expect(tab(screen, 'home')).toBeVisible({ timeout: 30_000 });
  });
});

/** The proposal clock is 7:00 AM. One short fling on a column moves it by one step. */
async function setClock(screen: Screen, chip: { x: number; y: number }, clock: string) {
  const match = /^(\d{1,2}):00 (AM|PM)$/.exec(clock);
  if (!match) {
    throw new Error(`clock must be on the hour: ${clock}`);
  }
  const hour = Number(match[1]);
  const hourDelta = hour - 7;
  await screen.tapAt(chip);
  // The wheel exposes its reading as a value ("7 o'clock"), not as text.
  const hourWheel = screen.getByDisplayValue(/o.clock/);
  await expect(hourWheel).toBeVisible();
  const hourBox = await hourWheel.boundingBox();
  if (!hourBox) {
    throw new Error('the hour wheel has no frame');
  }
  const x = hourBox.x + hourBox.width / 2;
  const y = hourBox.y + hourBox.height / 2;
  for (let step = 0; step < Math.abs(hourDelta); step += 1) {
    await nudgeWheel(screen, x, y, hourDelta > 0);
  }
  if (match[2] === 'PM') {
    const period = screen.getByDisplayValue(/^AM$/);
    await expect(period).toBeVisible();
    const periodBox = await period.boundingBox();
    if (!periodBox) {
      throw new Error('the AM/PM wheel has no frame');
    }
    await nudgeWheel(
      screen,
      periodBox.x + periodBox.width / 2,
      periodBox.y + periodBox.height / 2,
      true,
    );
  }
  // The popover's dismiss control covers the screen. This point is empty Home.
  await screen.tapAt({ x: 320, y: 160 });
}

async function nudgeWheel(screen: Screen, x: number, y: number, up: boolean) {
  await screen.swipe({
    from: { x, y: up ? y + 29 : y - 21 },
    to: { x, y: up ? y - 21 : y + 29 },
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
}
