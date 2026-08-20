import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('GET /api/attendance/summary/today - Dashboard Metrics', () => {
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
    const res = await supertest(app).get('/api/attendance/summary/today');
    expect(res.status).toBe(401);
  });

  it('returns today attendance summary metrics when authenticated', async () => {
    const res = await supertest(app)
      .get('/api/attendance/summary/today')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('present');
    expect(res.body).toHaveProperty('on_break');
    expect(res.body).toHaveProperty('absent');
    expect(res.body).toHaveProperty('late');
    expect(res.body).toHaveProperty('half_day');
    expect(res.body).toHaveProperty('total_employees');
    expect(typeof res.body.present).toBe('number');
    expect(typeof res.body.absent).toBe('number');
    expect(res.body.absent).toBe(res.body.total_employees - res.body.present);
  });
});
