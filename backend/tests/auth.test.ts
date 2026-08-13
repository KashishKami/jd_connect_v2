import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { decodeJwt } from 'jose';

describe('POST /api/auth/login - Authentication & Session Tracking', () => {
  beforeEach(async () => {
    await runMigrations();
    await runSeed();
  });

  it('returns 200 with access_token and valid JWT claims on correct credentials', async () => {
    const res = await supertest(app).post('/api/auth/login').send({
      email: 'admin@jdconnect.com',
      password: 'AdminSecret123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.token_type).toBe('Bearer');
    expect(res.body).toHaveProperty('access_token');

    const decoded = decodeJwt(res.body.access_token);
    expect(decoded).toHaveProperty('sub');
    expect(decoded).toHaveProperty('employee_id');
    expect(decoded.roles).toContain('super_admin');

    // Verify active session record created in Postgres employee_sessions table
    const sessionRes = await pool.query('SELECT * FROM employee_sessions WHERE user_id = $1 AND is_active = true', [
      decoded.sub,
    ]);
    expect(sessionRes.rows.length).toBeGreaterThan(0);
  });

  it('returns 401 Unauthorized for incorrect password', async () => {
    const res = await supertest(app).post('/api/auth/login').send({
      email: 'admin@jdconnect.com',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('returns 401 Unauthorized for non-existent email without leaking user existence', async () => {
    const res = await supertest(app).post('/api/auth/login').send({
      email: 'nonexistent@jdconnect.com',
      password: 'SomePassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });
});
