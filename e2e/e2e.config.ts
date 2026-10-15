import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';

import { changedPassword, seededAccount } from './support/accounts.ts';
import { agentModel } from './support/model.ts';

const apiPort = process.env.BSJ_E2E_API_PORT ?? '8010';

export default {
  // The first launch of a Release build plus sign-in over the scratch API is slow.
  timeout: 180_000,
  assertionTimeout: 10_000,
  targets: [
    {
      name: 'ios',
      engine: mobile({ platform: 'ios', device: process.env.BSJ_E2E_SIMULATOR ?? 'iPhone 17' }),
      app: {
        // A Release simulator build installed by `npx expo run:ios --configuration Release`
        // with EXPO_PUBLIC_API_URL pointing at the scratch API below.
        bundleId: 'com.abuiqbal.bsjhall',
        // No camera on a simulator: the Scan tab falls back to typing the pass code.
        permissions: { camera: 'deny', notifications: 'deny' },
        command: { executable: 'bash', args: ['scripts/serve-api.sh'] },
        readyUrl: `http://127.0.0.1:${apiPort}/health`,
      },
    },
  ],
  workers: 1,
  credentials: {
    resident: seededAccount('24-GLLB-118', 'E2E_RESIDENT_PASSWORD'),
    gate: seededAccount('gate.fatima', 'E2E_GATE_PASSWORD'),
    warden: seededAccount('warden.sara', 'E2E_WARDEN_PASSWORD'),
  },
  secrets: {
    'resident-new-password': changedPassword('24-GLLB-118'),
  },
  // Only tests tagged `agent` call a model; the rest are plain locators.
  agents: { default: { model: agentModel() } },
  cache: { mode: 'read-write', dir: '.e2e/cache' },
} satisfies E2EConfig;
