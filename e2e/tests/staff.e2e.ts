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
    await screen.getByTestId('scan-code').fill(RESIDENT_PASS);
    await screen.getByRole('button', 'Record').tap();
    // A fresh hall has no planned outing, so the gate sees who it is and why nothing was recorded.
    await expect(screen.getByText(/Aisha Khan|no planned outing/)).toBeVisible({ timeout: 15_000 });
  });
});
