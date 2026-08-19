import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('GET /api/breaks & GET /api/break-types Endpoints', () => {
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

    // Create Emp 1
    const u1 = await pool.query("INSERT INTO users (email, password_hash) VALUES ('bemp1@jdconnect.com', 'h') RETURNING id");
    const e1 = await pool.query(
      "INSERT INTO employees (auth_user_id, zulip_user_id, full_name, email, role_id) VALUES ($1, 401, 'Break Emp One', 'bemp1@jdconnect.com', $2) RETURNING id",
      [u1.rows[0].id, empRoleId]
    );
    employeeId = e1.rows[0].id;

    // Create Emp 2
    const u2 = await pool.query("INSERT INTO users (email, password_hash) VALUES ('bemp2@jdconnect.com', 'h') RETURNING id");
    const e2 = await pool.query(
      "INSERT INTO employees (auth_user_id, zulip_user_id, full_name, email, role_id) VALUES ($1, 402, 'Break Emp Two', 'bemp2@jdconnect.com', $2) RETURNING id",
      [u2.rows[0].id, empRoleId]
    );
    otherEmployeeId = e2.rows[0].id;

    // Get a break_type_id
    const btRes = await pool.query("SELECT id FROM break_types WHERE key = 'tea'");
    const teaTypeId = btRes.rows[0].id;

    // Seed break records
    await pool.query(
      `INSERT INTO break_records (employee_id, break_type_id, status, start_at)
       VALUES ($1, $3, 'active', now()),
              ($2, $3, 'completed', now() - interval '1 hour')`,
      [employeeId, otherEmployeeId, teaTypeId]
    );

    const { privateKey } = await generateKeyPair('RS256');

    employeeToken = await new SignJWT({
      sub: u1.rows[0].id,
      employee_id: employeeId,
      zulip_user_id: 401,
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

  it('allows employee to view own break records', async () => {
    const res = await supertest(app)
      .get('/api/breaks')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].employee_id).toBe(employeeId);
  });

  it('forbids employee from requesting another employee breaks', async () => {
    const res = await supertest(app)
      .get(`/api/breaks?employee_id=${otherEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it('allows super_admin to view all break records or filter by status/employee', async () => {
    const resAll = await supertest(app)
      .get('/api/breaks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resAll.status).toBe(200);
    expect(resAll.body.length).toBe(2);

    const resActive = await supertest(app)
      .get('/api/breaks?status=active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resActive.status).toBe(200);
    expect(resActive.body.length).toBe(1);
    expect(resActive.body[0].employee_id).toBe(employeeId);
  });

  it('allows super_admin to scope query to own records using employee_id=me', async () => {
    const resMe = await supertest(app)
      .get('/api/breaks?employee_id=me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resMe.status).toBe(200);
    expect(resMe.body.length).toBe(0);
  });


  it('GET /api/break-types returns list of active break types', async () => {
    const res = await supertest(app).get('/api/break-types');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('key');
  });
});
