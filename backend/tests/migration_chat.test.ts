import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { migrateChat } from '../scripts/migrate-chat';

describe('Chat History Migration (W-703)', () => {
  const tempDumpPath = path.resolve(__dirname, 'temp_mock_chat_dump.sql');

  // We mock two employees:
  // emp1: legacy ID = emp1_legacy_uuid, email = legacy.emp1@company.com, zulip_user_id = 501
  // emp2: legacy ID = emp2_legacy_uuid, email = legacy.emp2@company.com, zulip_user_id = 502
  // We mock:
  // - 1 channel of type 'department' (Sales-Team) -> public stream
  // - 1 channel of type 'custom' (ML-Team) -> private stream
  // - 1 DM conversation between emp1 and emp2
  const mockDumpSql = `
-- Mock SQL Dump
COPY public.employees (id, email, full_name, employee_code, zulip_user_id) FROM stdin;
emp1_legacy_uuid	legacy.emp1@company.com	Employee One	JD0901	501
emp2_legacy_uuid	legacy.emp2@company.com	Employee Two	JD0902	502
\\.

COPY public.channels (id, name, description, channel_type, department_id, centre_id, is_archived, is_announcement, created_at, updated_at) FROM stdin;
chan1_legacy_uuid	Sales-Team	Sales Department	department	\\N	\\N	f	f	2026-06-13 23:54:08+00	2026-06-13 23:54:08+00
chan2_legacy_uuid	ML-Team	Machine Learning Team	custom	\\N	\\N	f	f	2026-06-15 21:14:37+00	2026-06-15 21:14:37+00
\\.

COPY public.channel_members (id, channel_id, employee_id) FROM stdin;
memb1_legacy_uuid	chan1_legacy_uuid	emp1_legacy_uuid
memb2_legacy_uuid	chan1_legacy_uuid	emp2_legacy_uuid
memb3_legacy_uuid	chan2_legacy_uuid	emp1_legacy_uuid
\\.

COPY public.conversations (id, type, created_by, created_at, updated_at) FROM stdin;
conv1_legacy_uuid	direct	emp1_legacy_uuid	2026-06-14 00:00:53+00	2026-06-14 00:01:01+00
\\.

COPY public.conversation_participants (id, conversation_id, employee_id) FROM stdin;
part1_legacy_uuid	conv1_legacy_uuid	emp1_legacy_uuid
part2_legacy_uuid	conv1_legacy_uuid	emp2_legacy_uuid
\\.

COPY public.messages (id, conversation_id, channel_id, sender_id, body, created_at, attachments) FROM stdin;
msg1_legacy_uuid	\\N	chan1_legacy_uuid	emp1_legacy_uuid	Hello Sales Team	2026-06-13 23:59:01.766791+00	[]
msg2_legacy_uuid	conv1_legacy_uuid	\\N	emp2_legacy_uuid	Hi Employee One (DM)	2026-06-14 00:01:01.924432+00	[]
\\.
`;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();
    fs.writeFileSync(tempDumpPath, mockDumpSql, 'utf-8');
  });

  afterAll(async () => {
    if (fs.existsSync(tempDumpPath)) {
      fs.unlinkSync(tempDumpPath);
    }
  });

  it('migrates streams, DMs, and messages correctly with formatting and idempotency', async () => {
    // Seed mock employees in the new database so we can match them by email
    const userRes1 = await pool.query(
      "INSERT INTO users (email, password_hash, is_active) VALUES ('legacy.emp1@company.com', 'hashed', true) RETURNING id"
    );
    await pool.query(
      `INSERT INTO employees (auth_user_id, employee_code, full_name, email, employment_status, zulip_user_id, zulip_provisioned)
       VALUES ($1, 'JD0901', 'Employee One', 'legacy.emp1@company.com', 'active', 501, true) RETURNING id`,
      [userRes1.rows[0].id]
    );

    const userRes2 = await pool.query(
      "INSERT INTO users (email, password_hash, is_active) VALUES ('legacy.emp2@company.com', 'hashed', true) RETURNING id"
    );
    await pool.query(
      `INSERT INTO employees (auth_user_id, employee_code, full_name, email, employment_status, zulip_user_id, zulip_provisioned)
       VALUES ($1, 'JD0902', 'Employee Two', 'legacy.emp2@company.com', 'active', 502, true) RETURNING id`,
      [userRes2.rows[0].id]
    );

    const fetchCalls: Array<{ url: string; method: string; body?: string }> = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      let bodyData: string | undefined = undefined;
      if (init?.body) {
        bodyData = init.body.toString();
      }
      fetchCalls.push({ url, method, body: bodyData });

      if (url.includes('/api/v1/messages') && method === 'GET') {
        // Return empty array to signify no messages have been imported yet
        return {
          ok: true,
          json: async () => ({
            result: 'success',
            messages: [],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          result: 'success',
          msg: '',
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run chat migration (passing 10ms rate-limit delay instead of 650ms for faster tests)
    const summary = await migrateChat(tempDumpPath, 10);

    expect(summary.streamsCreated).toBe(2);
    expect(summary.messagesMigrated).toBe(2);

    // 1. Verify Stream Creations
    const streamSubscriptions = fetchCalls.filter((c) => c.url.includes('/api/v1/users/me/subscriptions') && c.method === 'POST');
    expect(streamSubscriptions.length).toBe(2);

    // Check Sales-Team (public stream)
    const salesSub = streamSubscriptions.find((c) => c.body?.includes('Sales-Team'));
    expect(salesSub).toBeDefined();
    expect(salesSub?.body).toContain('invite_only=false');
    expect(salesSub?.body).toContain('principals=' + encodeURIComponent(JSON.stringify([501, 502])));

    // Check ML-Team (private stream)
    const mlSub = streamSubscriptions.find((c) => c.body?.includes('ML-Team'));
    expect(mlSub).toBeDefined();
    expect(mlSub?.body).toContain('invite_only=true');
    expect(mlSub?.body).toContain('principals=' + encodeURIComponent(JSON.stringify([501])));

    // 2. Verify Messages Posted
    const messagePosts = fetchCalls.filter((c) => c.url.includes('/api/v1/messages') && c.method === 'POST');
    expect(messagePosts.length).toBe(2);

    // Stream message
    const streamMsg = messagePosts.find((c) => c.body?.includes('type=stream'));
    expect(streamMsg).toBeDefined();
    expect(streamMsg?.body).toContain('to=Sales-Team');
    expect(streamMsg?.body).toContain('topic=Migrated+History');
    const decodeBody = (body: string) => decodeURIComponent(body.replace(/\+/g, ' '));

    expect(decodeBody(streamMsg?.body || '')).toContain('**Employee One** · 13 Jun 2026');
    expect(decodeBody(streamMsg?.body || '')).toContain('Hello Sales Team');

    // DM message
    const dmMsg = messagePosts.find((c) => c.body?.includes('type=direct') || c.body?.includes('type=private'));
    expect(dmMsg).toBeDefined();
    expect(decodeBody(dmMsg?.body || '')).toContain('to=[501]');
    expect(decodeBody(dmMsg?.body || '')).toContain('**Employee Two** · 13 Jun 2026');
    expect(decodeBody(dmMsg?.body || '')).toContain('Hi Employee One (DM)');

    // 3. Verify Idempotency on rerun
    fetchCalls.length = 0; // Clear history
    const mockIdempotentFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      fetchCalls.push({ url, method });

      if (url.includes('/api/v1/messages') && method === 'GET') {
        // Return non-empty messages to simulate they already exist
        return {
          ok: true,
          json: async () => ({
            result: 'success',
            messages: [{ id: 9999, content: 'Some history' }],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ result: 'success', msg: '' }),
      };
    });
    vi.stubGlobal('fetch', mockIdempotentFetch);

    const summary2 = await migrateChat(tempDumpPath, 10);
    // Messages should NOT be posted again
    expect(summary2.messagesMigrated).toBe(0);

    const postRequests = fetchCalls.filter((c) => c.url.includes('/api/v1/messages') && c.method === 'POST');
    expect(postRequests.length).toBe(0);
  });
});
