import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('GET /api/attendance - Attendance History & Scoped Queries', () => {
  let employeeToken: string;
  let employeeId: string;
  let adminToken: string;

  let otherEmployeeId: string;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await runSeed();

    const empRoleRes = await pool.query("SELECT id FROM roles WHERE key = 'employee'");
    const empRoleId = empRoleRes.rows[0].id;

    // Create Employee 1
    const u1 = await pool.query("INSERT INTO users (email, password_hash) VALUES ('emp1@jdconnect.com', 'h') RETURNING id");
    const e1 = await pool.query(
      "INSERT INTO employees (auth_user_id, zulip_user_id, full_name, email, role_id) VALUES ($1, 301, 'Emp One', 'emp1@jdconnect.com', $2) RETURNING id",
      [u1.rows[0].id, empRoleId]
    );
    employeeId = e1.rows[0].id;

    // Create Employee 2
    const u2 = await pool.query("INSERT INTO users (email, password_hash) VALUES ('emp2@jdconnect.com', 'h') RETURNING id");
    const e2 = await pool.query(
      "INSERT INTO employees (auth_user_id, zulip_user_id, full_name, email, role_id) VALUES ($1, 302, 'Emp Two', 'emp2@jdconnect.com', $2) RETURNING id",
      [u2.rows[0].id, empRoleId]
    );
    otherEmployeeId = e2.rows[0].id;

    // Seed attendance records for emp1 and emp2
    await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status)
       VALUES ($1, '2026-08-10', '2026-08-10 09:00:00-05', 'present'),
              ($2, '2026-08-10', '2026-08-10 09:15:00-05', 'late')`,
      [employeeId, otherEmployeeId]
    );

    const { privateKey } = await generateKeyPair('RS256');

    employeeToken = await new SignJWT({
      sub: u1.rows[0].id,
      employee_id: employeeId,
      zulip_user_id: 301,
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey as KeyLike);

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

  it('allows employee to view own attendance records', async () => {
    const res = await supertest(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].employee_id).toBe(employeeId);
  });

  it('forbids employee from viewing another employees attendance records', async () => {
    const res = await supertest(app)
      .get(`/api/attendance?employee_id=${otherEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it('allows super_admin to view all attendance records or filter by employee', async () => {
    const resAll = await supertest(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resAll.status).toBe(200);
    expect(resAll.body.length).toBe(2);

    const resFilter = await supertest(app)
      .get(`/api/attendance?employee_id=${otherEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resFilter.status).toBe(200);
    expect(resFilter.body.length).toBe(1);
    expect(resFilter.body[0].employee_id).toBe(otherEmployeeId);
  });

  it('allows super_admin to scope query to own records using employee_id=me', async () => {
    const resMe = await supertest(app)
      .get('/api/attendance?employee_id=me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resMe.status).toBe(200);
    expect(resMe.body.length).toBe(0); // adminToken employee_id has no seeded attendance records
  });
});

