import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('POST /api/employees - Employee Creation', () => {
  let adminToken: string;
  let employeeToken: string;
  let superAdminRoleId: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();

    const roleRes = await pool.query("SELECT id FROM roles WHERE key = 'super_admin'");
    superAdminRoleId = roleRes.rows[0].id;

    // Generate test RSA keys for signing test JWTs
    const { privateKey } = await generateKeyPair('RS256');

    // Create Super Admin JWT with employees.manage permission
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

    // Create Standard Employee JWT without employees.manage permission
    employeeToken = await new SignJWT({
      sub: '00000000-0000-0000-0000-000000000003',
      employee_id: '00000000-0000-0000-0000-000000000004',
      zulip_user_id: 2,
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey as KeyLike);
  });

  it('returns 401 when request lacks Authorization header', async () => {
    const res = await supertest(app).post('/api/employees').send({
      full_name: 'John Doe',
      email: 'john@jdconnect.com',
      password: 'Password123!',
      role_id: superAdminRoleId,
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks employees.manage permission', async () => {
    const res = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        full_name: 'John Doe',
        email: 'john@jdconnect.com',
        password: 'Password123!',
        role_id: superAdminRoleId,
      });
    expect(res.status).toBe(403);
  });

  it('creates employee profile and user credential row on valid payload', async () => {
    const res = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Riya Sharma',
        email: 'riya.sharma@jdconnect.com',
        password: 'Password123!',
        role_id: superAdminRoleId,
        designation: 'Senior Agent',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('employee_code');
    expect(res.body.email).toBe('riya.sharma@jdconnect.com');
    expect(res.body.zulip_provisioned).toBe(false);

    // Verify row inserted in users table with bcrypt hash
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', ['riya.sharma@jdconnect.com']);
    expect(userRes.rows.length).toBe(1);
    expect(userRes.rows[0].password_hash).toMatch(/^\$2[ayb]\$/);

    // Verify row inserted in employees table
    const empRes = await pool.query('SELECT * FROM employees WHERE email = $1', ['riya.sharma@jdconnect.com']);
    expect(empRes.rows.length).toBe(1);
    expect(empRes.rows[0].full_name).toBe('Riya Sharma');
    expect(empRes.rows[0].zulip_provisioned).toBe(false);
  });

  it('returns 409 Conflict when creating employee with existing email', async () => {
    // Create first employee
    await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Original Agent',
        email: 'riya.sharma@jdconnect.com',
        password: 'Password123!',
        role_id: superAdminRoleId,
      });

    // Attempt to create second employee with exact same email
    const res = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Riya Duplicate',
        email: 'riya.sharma@jdconnect.com',
        password: 'Password123!',
        role_id: superAdminRoleId,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already exists' });
  });
});
