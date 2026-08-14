import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';
import { getESTWorkDate } from '../src/services/attendance.service';

describe('POST /api/breaks/start - Start Break Endpoint', () => {
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
       VALUES ('break.emp@jdconnect.com', 'hash')
       RETURNING id`
    );
    const userId = userRes.rows[0].id;

    zulipUserId = 301;
    const empRes = await pool.query(
      `INSERT INTO employees (auth_user_id, zulip_user_id, zulip_provisioned, full_name, email, role_id)
       VALUES ($1, $2, true, 'Break Employee', 'break.emp@jdconnect.com', $3)
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
    const res = await supertest(app)
      .post('/api/breaks/start')
      .send({ break_type_key: 'bio' });

    expect(res.status).toBe(401);
  });

  it('returns 400 Bad Request when employee is not clocked in today', async () => {
    const res = await supertest(app)
      .post('/api/breaks/start')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ break_type_key: 'bio' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'You must be clocked in to start a break' });
  });

  it('returns 400 Bad Request for invalid break_type_key', async () => {
    // First clock in
    const todayEST = getESTWorkDate();
    await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status)
       VALUES ($1, $2, now(), 'absent')`,
      [employeeId, todayEST]
    );

    const res = await supertest(app)
      .post('/api/breaks/start')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ break_type_key: 'invalid_type' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('starts break successfully and returns 201 Created', async () => {
    // Clock in first
    const todayEST = getESTWorkDate();
    await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status)
       VALUES ($1, $2, now(), 'absent')`,
      [employeeId, todayEST]
    );

    const res = await supertest(app)
      .post('/api/breaks/start')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ break_type_key: 'bio' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.employee_id).toBe(employeeId);
    expect(res.body.status).toBe('active');
    expect(res.body.end_at).toBeNull();
    expect(res.body.limit_minutes).toBe(10); // Bio break limit is 10 mins

    // Verify row in DB
    const dbRes = await pool.query(
      `SELECT * FROM break_records WHERE employee_id = $1 AND status = 'active'`,
      [employeeId]
    );
    expect(dbRes.rows.length).toBe(1);
  });

  it('returns 409 Conflict when attempting to start a break while another break is active', async () => {
    // Clock in first
    const todayEST = getESTWorkDate();
    await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status)
       VALUES ($1, $2, now(), 'absent')`,
      [employeeId, todayEST]
    );

    // Start first break
    const firstRes = await supertest(app)
      .post('/api/breaks/start')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ break_type_key: 'tea' });
    expect(firstRes.status).toBe(201);

    // Attempt second break
    const secondRes = await supertest(app)
      .post('/api/breaks/start')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ break_type_key: 'bio' });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body).toEqual({ error: 'Already on an active break' });
  });
});
