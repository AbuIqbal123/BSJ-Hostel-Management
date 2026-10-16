import { beforeEach, describe, test } from '@e2e-dev/mobile';
import { credentials, expect, secrets } from 'e2e';

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

  test('plans an ordinary outing', { tags: ['agent'] }, async ({ agent, screen }) => {
    await screen.getByText('Choose a place').tap();
    await screen.getByRole('button', 'Maulana Azad Library').tap();
    // The iOS date and time chips open the system picker; the agent sets them, the cache replays it.
    await agent.act(`In Plan an outing, set Leave at to tomorrow at ${ordinaryOuting.leave} and Back by to tomorrow at ${ordinaryOuting.back}, then close any open picker`);
    await expect(screen.getByRole('button', 'Confirm')).toBeEnabled();
    await screen.getByRole('button', 'Confirm').tap();
    await expect(screen.getByText('Upcoming outings')).toBeVisible({ timeout: 15_000 });
    await expect(screen.getByRole('button', /^Maulana Azad Library\./)).toBeVisible();
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
    await screen.getByRole('button', 'History').tap();
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
      await screen.getByRole('button', 'History').tap();
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
    await screen.getByRole('tab', 'Guest stays').tap();
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
