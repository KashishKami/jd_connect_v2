import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';
import { getESTWorkDate } from '../src/services/attendance.service';

describe('POST /api/attendance/clock-out - Employee Clock Out', () => {
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

    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ('clockout.emp@jdconnect.com', 'hash')
       RETURNING id`
    );
    const userId = userRes.rows[0].id;

    zulipUserId = 202;
    const empRes = await pool.query(
      `INSERT INTO employees (auth_user_id, zulip_user_id, zulip_provisioned, full_name, email, role_id)
       VALUES ($1, $2, true, 'Clockout Employee', 'clockout.emp@jdconnect.com', $3)
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

  it('returns 400 Bad Request when attempting clock-out without an open clock-in record', async () => {
    const res = await supertest(app)
      .post('/api/attendance/clock-out')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No open clock-in record found for today' });
  });

  it('clocks out successfully, computes hours worked, and updates status to present for 9-hour on-time shift', async () => {
    const todayEST = getESTWorkDate();
    // Simulate clock in 9 hours ago on-time
    const clockInTime = new Date(Date.now() - 9 * 3600 * 1000);
    await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status)
       VALUES ($1, $2, $3, 'absent')`,
      [employeeId, todayEST, clockInTime]
    );

    const res = await supertest(app)
      .post('/api/attendance/clock-out')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employee_id).toBe(employeeId);
    expect(res.body.clock_out_at).not.toBeNull();
    expect(Number(res.body.hours_worked)).toBeGreaterThanOrEqual(8.9);
    expect(res.body.status).toBe('present');
    expect(res.body.is_late).toBe(false);

    // Verify DB update
    const dbRes = await pool.query(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [employeeId, todayEST]
    );
    expect(dbRes.rows[0].clock_out_at).not.toBeNull();
  });
});
