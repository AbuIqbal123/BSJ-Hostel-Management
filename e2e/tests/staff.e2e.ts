import { describe, test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

import { freshLaunch, signIn, tab } from '../support/flows.ts';

// The dev hall pass code from backend/app/dev_seed.py; a simulator has no camera to read the QR.
const RESIDENT_PASS = 'bsj:v1:test-resident-hall-pass';

describe('staff', { tags: ['staff'] }, () => {
  test('warden Home, Out now and Requests', async ({ app, device, screen }) => {
    await freshLaunch(app, device, screen);
    await signIn(screen, 'warden');
    await expect(tab(screen, 'index')).toBeVisible({ timeout: 30_000 });
    await expect(tab(screen, 'requests')).toBeVisible();

    await screen.getByRole('button', /Out now/).tap();
    await expect(screen.getByText('Out now')).toBeVisible();
    await screen.getByRole('button', 'Ordinary').tap();
    await expect(screen.getByText('No one is out')).toBeVisible();
    await screen.getByRole('button', 'Permission').tap();
    await expect(screen.getByText('No one is out')).toBeVisible();
    await screen.getByRole('button', 'Late').tap();
    await expect(screen.getByRole('button', 'Still out')).toBeVisible();
    await expect(screen.getByText('No one is late')).toBeVisible();
    await screen.getByRole('button', 'Came back late').tap();
    await expect(screen.getByText('No late returns')).toBeVisible();
    await screen.getByRole('button', 'Back').tap();

    await tab(screen, 'requests').tap();
    await expect(screen.getByText('Requests')).toBeVisible();
  });

  test('gate Scan records by pass code', async ({ app, device, screen }) => {
    await freshLaunch(app, device, screen);
    await signIn(screen, 'gate');
    await expect(tab(screen, 'scan')).toBeVisible({ timeout: 30_000 });
    // Gate accounts have no Requests tab.
    await expect(tab(screen, 'requests')).toHaveCount(0);

    await tab(screen, 'scan').tap();
    const code = screen.getByTestId('scan-code');
    await code.fill(RESIDENT_PASS);
    // Record sits under the keyboard. Enter is the field's return key and submits the same code.
    await code.press('Enter');
    // A fresh hall has no planned outing. A planned one is not open until thirty minutes before.
    // The card's spoken label repeats both lines, so each line is matched on its own.
    await expect(screen.getByText('Aisha Khan')).toBeVisible({ timeout: 15_000 });
    await expect(
      screen.getByText(/There is no planned outing|30 minutes before its start/),
    ).toBeVisible();
  });
});
