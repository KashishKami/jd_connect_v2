import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('POST /api/attendance/clock-in - Employee Clock In', () => {
  let employeeToken: string;
  let employeeId: string;
  let zulipUserId: number;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await runSeed();

    const roleRes = await pool.query("SELECT id FROM roles WHERE key = 'employee'");
    const empRoleId = roleRes.rows[0].id;

    // Create an auth user & employee record in DB
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ('clockin.emp@jdconnect.com', 'hash')
       RETURNING id`
    );
    const userId = userRes.rows[0].id;

    zulipUserId = 101;
    const empRes = await pool.query(
      `INSERT INTO employees (auth_user_id, zulip_user_id, zulip_provisioned, full_name, email, role_id)
       VALUES ($1, $2, true, 'Clockin Employee', 'clockin.emp@jdconnect.com', $3)
       RETURNING id`,
      [userId, zulipUserId, empRoleId]
    );
    employeeId = empRes.rows[0].id;

    const { privateKey } = await generateKeyPair('RS256');

    employeeToken = await new SignJWT({
      sub: userId,
      employee_id: employeeId,
      zulip_user_id: zulipUserId,
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey as KeyLike);
  });

  it('returns 401 Unauthorized when no Authorization header is provided', async () => {
    const res = await supertest(app).post('/api/attendance/clock-in');
    expect(res.status).toBe(401);
  });

  it('clocks in employee successfully and returns 201 Created', async () => {
    const res = await supertest(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.employee_id).toBe(employeeId);
    expect(res.body).toHaveProperty('work_date');
    expect(res.body).toHaveProperty('clock_in_at');
    expect(res.body.clock_out_at).toBeNull();

    // Verify row directly in DB
    const dbRes = await pool.query(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND clock_out_at IS NULL`,
      [employeeId]
    );
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].id).toBe(res.body.id);
  });

  it('returns 409 Conflict when attempting to clock in twice on the same day', async () => {
    // First clock in
    const firstRes = await supertest(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(firstRes.status).toBe(201);

    // Second clock in
    const secondRes = await supertest(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(secondRes.status).toBe(409);
    expect(secondRes.body).toEqual({ error: 'Already clocked in for today' });

    // Verify DB count is still 1
    const dbRes = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE employee_id = $1`,
      [employeeId]
    );
    expect(parseInt(dbRes.rows[0].count, 10)).toBe(1);
  });
});
