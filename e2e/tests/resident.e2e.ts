import { beforeEach, describe, test } from '@e2e-dev/mobile';
import { credentials, expect, secrets } from 'e2e';

import { freshLaunch, signIn, tab } from '../support/flows.ts';

describe('resident', { tags: ['resident'] }, () => {
  beforeEach(async ({ app, device, screen }) => {
    await freshLaunch(app, device, screen);
    await signIn(screen, 'resident');
    await expect(tab(screen, 'home')).toBeVisible({ timeout: 30_000 });
  });

  test('signs in to Home', async ({ screen }) => {
    await expect(screen.getByText('Plan an outing')).toBeVisible();
    await expect(screen.getByRole('button', 'Notifications')).toBeVisible();
  });

  test('hall pass tab shows the pass state', async ({ screen }) => {
    await tab(screen, 'pass').tap();
    // A fresh hall has no outing, so there is no live pass yet.
    await expect(screen.getByText(/No pass right now|You have a planned outing/)).toBeVisible();
  });

  test('permissions lists the three request kinds', async ({ screen }) => {
    await tab(screen, 'permissions').tap();
    await expect(screen.getByRole('button', 'Request late-night')).toBeVisible();
    await expect(screen.getByRole('button', 'Request home going')).toBeVisible();
    await expect(screen.getByRole('button', 'Request guest stay')).toBeVisible();
    await screen.getByRole('button', 'Request late-night').tap();
    await expect(screen.getByRole('button', 'Back')).toBeVisible();
  });

  test('plans an ordinary outing', { tags: ['agent'] }, async ({ agent, screen }) => {
    await screen.getByText('Choose a place').tap();
    await screen.getByRole('button', 'Maulana Azad Library').tap();
    // The iOS date and time chips open the system picker; the agent sets them, the cache replays it.
    await agent.act('In Plan an outing, set Leave at to tomorrow at 10:00 AM and Back by to tomorrow at 6:00 PM, then close any open picker');
    await expect(screen.getByRole('button', 'Confirm')).toBeEnabled();
    await screen.getByRole('button', 'Confirm').tap();
    await expect(screen.getByText('Upcoming outings')).toBeVisible({ timeout: 15_000 });
    await expect(screen.getByRole('button', /^Maulana Azad Library\./)).toBeVisible();
  });

  test('settings opens Change password', async ({ screen }) => {
    await tab(screen, 'settings').tap();
    await expect(screen.getByRole('button', 'Sign out')).toBeVisible();
    await screen.getByRole('button', /^Change password/).tap();
    await expect(screen.getByLabel('Current password')).toBeVisible();
    await expect(screen.getByRole('button', 'Change password')).toBeDisabled();
  });

  // Last: it changes the resident's password. The next run reseeds a fresh hall.
  test('changes the password and signs in with the new one', async ({ screen }) => {
    await tab(screen, 'settings').tap();
    await screen.getByRole('button', /^Change password/).tap();
    await screen.getByLabel('Current password').fill(credentials.user('resident').password);
    await screen.getByLabel('New password').fill(secrets.get('resident-new-password'));
    await screen.getByRole('button', 'Change password').tap();
    await expect(screen.getByRole('button', 'Sign in')).toBeVisible({ timeout: 15_000 });
    await screen.getByLabel('Username').fill(credentials.user('resident').username);
    await screen.getByLabel('Password').fill(secrets.get('resident-new-password'));
    await screen.getByRole('button', 'Sign in').tap();
    await expect(tab(screen, 'home')).toBeVisible({ timeout: 30_000 });
  });
});
