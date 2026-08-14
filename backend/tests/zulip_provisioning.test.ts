import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('Zulip User Provisioning Integration (W-401)', () => {
  let adminToken: string;
  let superAdminRoleId: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();

    const roleRes = await pool.query("SELECT id FROM roles WHERE key = 'super_admin'");
    superAdminRoleId = roleRes.rows[0].id;

    const { privateKey } = await generateKeyPair('RS256');

    adminToken = await new SignJWT({
      sub: '00000000-0000-0000-0000-000000000001',
      employee_id: '00000000-0000-0000-0000-000000000002',
      zulip_user_id: 1,
      roles: ['super_admin'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey as KeyLike);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates employee and provisions Zulip user successfully (zulip_provisioned = true)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'success',
        user_id: 101,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Zulip User 1',
        email: 'zulip1@company.com',
        password: 'Password123!',
        role_id: superAdminRoleId,
      });

    expect(res.status).toBe(201);
    expect(res.body.zulip_provisioned).toBe(true);
    expect(res.body.zulip_user_id).toBe(101);

    const dbRes = await pool.query('SELECT zulip_provisioned, zulip_user_id FROM employees WHERE email = $1', ['zulip1@company.com']);
    expect(dbRes.rows[0].zulip_provisioned).toBe(true);
    expect(dbRes.rows[0].zulip_user_id).toBe(101);
  });

  it('handles Zulip API failure gracefully (zulip_provisioned = false) and allows retry', async () => {
    const failFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ result: 'error', msg: 'Zulip server error' }),
    });
    vi.stubGlobal('fetch', failFetch);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Zulip User 2',
        email: 'zulip2@company.com',
        password: 'Password123!',
        role_id: superAdminRoleId,
      });

    expect(res.status).toBe(201);
    expect(res.body.zulip_provisioned).toBe(false);
    expect(res.body.zulip_user_id).toBeNull();
    expect(res.body.warning).toBe('Zulip account creation failed');

    const empId = res.body.id;

    // Retry provisioning with succeeding Zulip mock
    const successFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'success',
        user_id: 102,
      }),
    });
    vi.stubGlobal('fetch', successFetch);

    const retryRes = await request(app)
      .post(`/api/employees/${empId}/retry-zulip-provisioning`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.zulip_provisioned).toBe(true);
    expect(retryRes.body.zulip_user_id).toBe(102);
  });
});
