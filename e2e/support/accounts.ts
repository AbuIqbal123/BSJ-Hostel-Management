import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where scripts/serve-api.sh keeps the scratch hall and its seed output. */
export const stateDir = process.env.BSJ_E2E_STATE ?? join(tmpdir(), 'bsj-e2e');

/**
 * The dev password for a seeded account, read when the runner fills the field.
 * The phrases stay out of the repository, the environment, and the model input.
 */
export function seededPassword(username: string): () => string {
  return () => {
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
export function seededAccount(username: string) {
  return { username, password: seededPassword(username) };
}

/** A new password that meets the app's rules, derived from the seeded one. */
export function changedPassword(username: string): () => string {
  const seeded = seededPassword(username);
  return () => `${seeded()}-e2E`;
}
