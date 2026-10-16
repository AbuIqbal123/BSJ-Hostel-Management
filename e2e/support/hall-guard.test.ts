import { mkdtempSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { removeSeededHall, seedGuestTabs, seedHistoryPages } from './hall.ts';

const REFUSAL = /seeding refuses to run against a non-scratch server/;

describe('scratch seeding guard', () => {
  test('seeding refuses a server that is not marked scratch', async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    process.env.BSJ_E2E_API_PORT = '8010';
    try {
      await assert.rejects(seedHistoryPages(), REFUSAL);
      await assert.rejects(seedGuestTabs(), REFUSAL);
      assert.deepEqual(calls, [
        'GET http://127.0.0.1:8010/health',
        'GET http://127.0.0.1:8010/health',
      ]);
    } finally {
      globalThis.fetch = original;
      delete process.env.BSJ_E2E_API_PORT;
    }
  });

  test('seeding refuses port 8000 even when the marker is present', async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      return new Response(JSON.stringify({ status: 'ok', e2e_scratch: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    process.env.BSJ_E2E_API_PORT = '8000';
    try {
      await assert.rejects(seedHistoryPages(), REFUSAL);
      assert.deepEqual(calls, []);
    } finally {
      globalThis.fetch = original;
      delete process.env.BSJ_E2E_API_PORT;
    }
  });

  test('teardown deletes the seeded permission and guest rows', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'bsj-scratch-'));
    const database = join(directory, 'hostel.db');
    const db = new DatabaseSync(database);
    db.exec(`
      CREATE TABLE permissions (id TEXT PRIMARY KEY, short_place TEXT);
      CREATE TABLE guest_stays (id TEXT PRIMARY KEY, guest_name TEXT);
      INSERT INTO permissions (id, short_place) VALUES ('page-row', 'Page 01');
      INSERT INTO guest_stays (id, guest_name) VALUES ('stay-row', 'Lina Qureshi');
      INSERT INTO guest_stays (id, guest_name) VALUES ('older-row', 'Hana Qureshi');
      INSERT INTO permissions (id, short_place) VALUES ('kept', 'Library');
    `);
    db.close();
    process.env.BSJ_E2E_STATE = directory;
    try {
      await removeSeededHall();
      const check = new DatabaseSync(database);
      const places = check.prepare('SELECT short_place FROM permissions ORDER BY short_place').all() as {
        short_place: string;
      }[];
      const guests = check.prepare('SELECT guest_name FROM guest_stays').all();
      check.close();
      assert.deepEqual(
        places.map((row) => row.short_place),
        ['Library'],
      );
      assert.deepEqual(guests, []);
    } finally {
      delete process.env.BSJ_E2E_STATE;
    }
  });
});
