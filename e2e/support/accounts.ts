import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where scripts/serve-api.sh keeps the scratch hall and its seed output. */
export const stateDir = process.env.BSJ_E2E_STATE ?? join(tmpdir(), 'bsj-e2e');

/**
 * The password for a seeded account, read when the runner fills the field:
 * the named env var (E2E_RESIDENT_PASSWORD, E2E_GATE_PASSWORD, E2E_WARDEN_PASSWORD) when set,
 * else the scratch hall's seed output.
 * The phrases stay out of the repository, the environment, and the model input.
 */
export function seededPassword(username: string, envName?: string): () => string {
  return () => {
    const fromEnv = envName ? process.env[envName] : undefined;
    if (fromEnv) {
      return fromEnv;
    }
    const seed = readFileSync(join(stateDir, 'seed-accounts.txt'), 'utf8');
    for (const line of seed.split('\n')) {
      const [name, phrase] = line.trim().split(/\s+/);
      if (name === username && phrase) {
        return phrase;
      }
    }
    throw new Error(`no seeded password for ${username}; did scripts/serve-api.sh run on a fresh hall?`);
  };
}

/** A seeded dev account for `credentials`: the username plus a fill-time lookup of its password. */
export function seededAccount(username: string, envName: string) {
  return { username, password: seededPassword(username, envName) };
}

/** A new password that meets the app's rules, derived from the seeded one. */
export function changedPassword(username: string): () => string {
  const seeded = seededPassword(username, 'E2E_RESIDENT_PASSWORD');
  return () => `${seeded()}-e2E`;
}
