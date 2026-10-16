import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import { seededPassword, stateDir } from './accounts.ts';

const apiPort = process.env.BSJ_E2E_API_PORT ?? '8010';

export function apiBase(): string {
  return `http://127.0.0.1:${apiPort}`;
}

/** Hall calendar day, Asia/Kolkata, as YYYY-MM-DD. `offset` is whole days ahead. */
export function hallDay(offset: number): string {
  const hallNow = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  const day = new Date(Date.UTC(hallNow.getUTCFullYear(), hallNow.getUTCMonth(), hallNow.getUTCDate() + offset));
  return day.toISOString().slice(0, 10);
}

/** 7:00 PM IST on the next hall day, plus `extraMinutes` on the return. Both seasons are closed by then. */
export function lateNightSpan(extraMinutes: number): { departure: string; back: string } {
  const start = hallDay(1);
  const departure = new Date(`${start}T13:30:00Z`);
  const back = new Date(departure.getTime() + (30 + extraMinutes) * 60 * 1000);
  return {
    departure: departure.toISOString().replace('.000Z', 'Z'),
    back: back.toISOString().replace('.000Z', 'Z'),
  };
}

async function login(username: string, envName: string): Promise<string> {
  const password = seededPassword(username, envName)();
  const response = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`${username} sign-in failed: ${response.status}`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error(`${username} sign-in returned no token`);
  }
  return body.access_token;
}

async function post(token: string, path: string, body?: unknown): Promise<{ id: string }> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${path} failed: ${response.status} ${detail.slice(0, 180)}`);
  }
  return (await response.json()) as { id: string };
}

/** Fifty-one cancelled late-night permissions, so History's first page is not the whole list. */
export async function seedHistoryPages(): Promise<void> {
  const token = await login('24-GLLB-118', 'E2E_RESIDENT_PASSWORD');
  for (let index = 1; index <= 51; index += 1) {
    const when = lateNightSpan(index);
    const created = await post(token, '/api/v1/me/permissions', {
      permission_type: 'late_night',
      short_place: `Page ${String(index).padStart(2, '0')}`,
      reason: 'A closed permission so History has another page.',
      departure_at: when.departure,
      expected_return_at: when.back,
    });
    await post(token, `/api/v1/me/permissions/${created.id}/cancel`);
  }
}

/** One stay still ahead, and one cancelled stay that belongs under Show older. */
export async function seedGuestTabs(): Promise<{ upcoming: string; older: string }> {
  const token = await login('24-GLLB-118', 'E2E_RESIDENT_PASSWORD');
  const upcoming = 'Lina Qureshi';
  const older = 'Hana Qureshi';
  const dates = { guest_start_date: hallDay(2), guest_end_date: hallDay(3), relation: 'Cousin' };
  await post(token, '/api/v1/me/guest-stays', {
    ...dates,
    guest_name: upcoming,
    reason: 'A stay that is still ahead.',
  });
  const cancelled = await post(token, '/api/v1/me/guest-stays', {
    ...dates,
    guest_name: older,
    reason: 'A stay that was cancelled.',
  });
  await post(token, `/api/v1/me/guest-stays/${cancelled.id}/cancel`);
  return { upcoming, older };
}

const LOCK_SCRIPT = `
import sqlite3, sys, time
connection = sqlite3.connect(sys.argv[1], timeout=20)
connection.execute("BEGIN EXCLUSIVE")
print("locked", flush=True)
time.sleep(120)
`;

/** Hold the scratch database so the next list read fails, then let it through again. */
export function holdHallDatabase(): Promise<{ release(): void }> {
  const database = join(stateDir, 'hostel.db');
  const child: ChildProcess = spawn('python3', ['-c', LOCK_SCRIPT, database], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('could not lock the scratch hall'));
    }, 20_000);
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on('exit', (code) => {
      if (code !== null && code !== 0 && code !== 15) {
        clearTimeout(timer);
        reject(new Error(`hall lock exited ${code}: ${stderr.slice(0, 180)}`));
      }
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      if (!String(chunk).includes('locked')) {
        return;
      }
      clearTimeout(timer);
      resolve({
        release() {
          child.kill();
        },
      });
    });
  });
}
