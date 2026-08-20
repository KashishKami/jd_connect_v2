import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('GET /api/departments', () => {
  let userToken: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();

    const { privateKey } = await generateKeyPair('RS256');
    userToken = await new SignJWT({
      sub: '00000000-0000-0000-0000-000000000001',
      employee_id: '00000000-0000-0000-0000-000000000002',
      zulip_user_id: 1,
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey as KeyLike);
  });

  it('returns 401 when request lacks Authorization header', async () => {
    const res = await supertest(app).get('/api/departments');
    expect(res.status).toBe(401);
  });

  it('returns 200 and list of active departments when authenticated', async () => {
    const res = await supertest(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const names = res.body.map((d: { id: string; name: string }) => d.name);
    expect(names).toContain('Sales');
    expect(names).toContain('Backend');
    expect(names).toContain('HR');
  });
});
