import { spawn } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { seededPassword } from './accounts.ts';

function scratchStateDir(): string {
  return process.env.BSJ_E2E_STATE ?? join(tmpdir(), 'bsj-e2e');
}

const SCRATCH_REFUSAL = 'seeding refuses to run against a non-scratch server';

function apiPort(): string {
  return process.env.BSJ_E2E_API_PORT ?? '8010';
}

export function apiBase(): string {
  return `http://127.0.0.1:${apiPort()}`;
}

/** The throwaway server sets E2E_SCRATCH and reports it on /health. Port 8000 is never that server. */
async function assertScratchServer(): Promise<void> {
  if (apiPort() === '8000') {
    throw new Error(`${SCRATCH_REFUSAL}. Port 8000 is the hall server.`);
  }
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/health`);
  } catch {
    throw new Error(`${SCRATCH_REFUSAL}. The hall did not answer /health.`);
  }
  if (!response.ok) {
    throw new Error(`${SCRATCH_REFUSAL}. /health returned ${response.status}.`);
  }
  const body = (await response.json()) as { e2e_scratch?: unknown };
  if (body.e2e_scratch !== true) {
    throw new Error(`${SCRATCH_REFUSAL}.`);
  }
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
  await assertScratchServer();
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
  await assertScratchServer();
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

const REMOVE_SEEDED = `
import sqlite3, sys
connection = sqlite3.connect(sys.argv[1], timeout=20)
connection.execute("PRAGMA foreign_keys=ON")
names = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}

def columns(table):
    if table not in names:
        return set()
    return {row[1] for row in connection.execute("PRAGMA table_info(" + table + ")")}

def delete_where(table, column, ids):
    if column not in columns(table) or not ids:
        return
    marks = ",".join("?" for _ in ids)
    connection.execute("DELETE FROM " + table + " WHERE " + column + " IN (" + marks + ")", ids)

permission_ids = []
guest_ids = []
if "short_place" in columns("permissions"):
    permission_ids = [
        row[0]
        for row in connection.execute(
            "SELECT id FROM permissions WHERE short_place GLOB 'Page [0-9][0-9]'"
        )
    ]
if "guest_name" in columns("guest_stays"):
    guest_ids = [
        row[0]
        for row in connection.execute(
            "SELECT id FROM guest_stays WHERE guest_name IN ('Lina Qureshi', 'Hana Qureshi')"
        )
    ]
if permission_ids or guest_ids:
    # The hall refuses these deletes. This file is the throwaway scratch database.
    connection.execute("DROP TRIGGER IF EXISTS permissions_no_delete")
    connection.execute("DROP TRIGGER IF EXISTS guest_stays_no_delete")
    connection.execute("DROP TRIGGER IF EXISTS outings_no_delete")
notice_ids = permission_ids + guest_ids
if "record_id" in columns("resident_notifications"):
    delete_where("resident_notifications", "record_id", notice_ids)
else:
    delete_where("resident_notifications", "permission_id", permission_ids)
delete_where("outings", "permission_id", permission_ids)
delete_where("guest_stay_payment_evidence", "guest_stay_id", guest_ids)
delete_where("permissions", "id", permission_ids)
delete_where("guest_stays", "id", guest_ids)
connection.commit()
`;

/** Remove the Page NN permissions and the seeded guest stays. Safe to call when nothing was seeded. */
export function removeSeededHall(): Promise<void> {
  const database = join(scratchStateDir(), 'hostel.db');
  if (!existsSync(database)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', REMOVE_SEEDED, database], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`could not remove seeded rows: ${stderr.slice(0, 180)}`));
    });
  });
}

/** The scratch hall is WAL, so a second connection's exclusive lock does not stop a reader. */
function scratchDatabaseFiles(): string[] {
  const database = join(scratchStateDir(), 'hostel.db');
  return [database, `${database}-wal`, `${database}-shm`].filter((path) => existsSync(path));
}

/** Make the scratch database unreadable so the next list read fails, then restore it. */
export function holdHallDatabase(): { release(): void } {
  const files = scratchDatabaseFiles();
  if (!files.some((path) => path.endsWith('hostel.db'))) {
    throw new Error('the scratch hall is not there');
  }
  for (const path of files) {
    chmodSync(path, 0);
  }
  return {
    release() {
      for (const path of files) {
        chmodSync(path, 0o600);
      }
    },
  };
}
