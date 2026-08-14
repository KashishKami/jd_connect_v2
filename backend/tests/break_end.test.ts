import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';
import { getESTWorkDate } from '../src/services/attendance.service';

describe('POST /api/breaks/end - End Break Endpoint', () => {
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
       VALUES ('breakend.emp@jdconnect.com', 'hash')
       RETURNING id`
    );
    const userId = userRes.rows[0].id;

    zulipUserId = 302;
    const empRes = await pool.query(
      `INSERT INTO employees (auth_user_id, zulip_user_id, zulip_provisioned, full_name, email, role_id)
       VALUES ($1, $2, true, 'Break End Employee', 'breakend.emp@jdconnect.com', $3)
       RETURNING id`,
      [userId, zulipUserId, empRoleId]
    );
    employeeId = empRes.rows[0].id;

    // Clock in employee
    const todayEST = getESTWorkDate();
    await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status)
       VALUES ($1, $2, now(), 'absent')`,
      [employeeId, todayEST]
    );

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

  it('returns 400 Bad Request when attempting to end a break with no active break record', async () => {
    const res = await supertest(app)
      .post('/api/breaks/end')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No active break found to end' });
  });

  it('ends active break within limit successfully and marks status completed', async () => {
    const typeRes = await pool.query("SELECT id FROM break_types WHERE key = 'tea'");
    const teaTypeId = typeRes.rows[0].id;

    // Simulate break started 10 minutes ago (limit is 15 mins)
    const startAt = new Date(Date.now() - 10 * 60 * 1000);
    await pool.query(
      `INSERT INTO break_records (employee_id, break_type_id, limit_minutes, status, start_at)
       VALUES ($1, $2, 15, 'active', $3)`,
      [employeeId, teaTypeId, startAt]
    );

    const res = await supertest(app)
      .post('/api/breaks/end')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employee_id).toBe(employeeId);
    expect(res.body.status).toBe('completed');
    expect(Number(res.body.duration_minutes)).toBeGreaterThanOrEqual(9.9);

    // Verify DB
    const dbRes = await pool.query(`SELECT * FROM break_records WHERE employee_id = $1`, [employeeId]);
    expect(dbRes.rows[0].status).toBe('completed');
    expect(dbRes.rows[0].end_at).not.toBeNull();
  });

  it('ends active break exceeding limit successfully and marks status exceeded', async () => {
    const typeRes = await pool.query("SELECT id FROM break_types WHERE key = 'tea'");
    const teaTypeId = typeRes.rows[0].id;

    // Simulate break started 20 minutes ago (limit is 15 mins)
    const startAt = new Date(Date.now() - 20 * 60 * 1000);
    await pool.query(
      `INSERT INTO break_records (employee_id, break_type_id, limit_minutes, status, start_at)
       VALUES ($1, $2, 15, 'active', $3)`,
      [employeeId, teaTypeId, startAt]
    );

    const res = await supertest(app)
      .post('/api/breaks/end')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('exceeded');
    expect(Number(res.body.duration_minutes)).toBeGreaterThanOrEqual(19.9);
  });
});
