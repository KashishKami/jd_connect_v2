import { describe, it, expect, beforeEach } from 'vitest';
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

  beforeEach(async () => {
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
    expect(typeof res.body.zulip_provisioned).toBe('boolean');

    // Verify row inserted in users table with bcrypt hash
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', ['riya.sharma@jdconnect.com']);
    expect(userRes.rows.length).toBe(1);
    expect(userRes.rows[0].password_hash).toMatch(/^\$2[ayb]\$/);

    // Verify row inserted in employees table
    const empRes = await pool.query('SELECT * FROM employees WHERE email = $1', ['riya.sharma@jdconnect.com']);
    expect(empRes.rows.length).toBe(1);
    expect(empRes.rows[0].full_name).toBe('Riya Sharma');
    expect(typeof empRes.rows[0].zulip_provisioned).toBe('boolean');
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

  it('creates employee using role_key instead of role_id', async () => {
    const res = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Key User',
        email: 'keyuser@jdconnect.com',
        password: 'Password123!',
        role_key: 'employee',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe('keyuser@jdconnect.com');
  });

  it('creates employee with alias and returns alias in response and DB', async () => {
    const res = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Adam Johnson',
        alias: 'Adam',
        email: 'adam.johnson@jdconnect.com',
        password: 'Password123!',
        role_key: 'employee',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('alias', 'Adam');

    const empRes = await pool.query('SELECT * FROM employees WHERE email = $1', ['adam.johnson@jdconnect.com']);
    expect(empRes.rows.length).toBe(1);
    expect(empRes.rows[0].alias).toBe('Adam');
  });

  it('creates employee without alias resulting in null alias in DB', async () => {
    const res = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'No Alias User',
        email: 'noalias@jdconnect.com',
        password: 'Password123!',
        role_key: 'employee',
      });

    expect(res.status).toBe(201);
    expect(res.body.alias).toBeNull();

    const empRes = await pool.query('SELECT * FROM employees WHERE email = $1', ['noalias@jdconnect.com']);
    expect(empRes.rows.length).toBe(1);
    expect(empRes.rows[0].alias).toBeNull();
  });

  it('GET /api/employees lists all employees with department and role', async () => {
    await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Listed Agent',
        email: 'listed@jdconnect.com',
        password: 'Password123!',
        role_key: 'employee',
      });

    const res = await supertest(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const emp = res.body[0];
    expect(emp).toHaveProperty('id');
    expect(emp).toHaveProperty('full_name');
    expect(emp).toHaveProperty('email');
    expect(emp).toHaveProperty('role');
    expect(emp).toHaveProperty('zulip_provisioned');
  });

  it('GET /api/employees supports search filter matching full_name or alias', async () => {
    await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Searchable FullName',
        alias: 'UniqueAlias',
        email: 'searchable@jdconnect.com',
        password: 'Password123!',
        role_key: 'employee',
      });

    const resAlias = await supertest(app)
      .get('/api/employees?search=uniquealias')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAlias.status).toBe(200);
    expect(resAlias.body.some((e: { email: string }) => e.email === 'searchable@jdconnect.com')).toBe(true);

    const resFullName = await supertest(app)
      .get('/api/employees?search=searchable')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resFullName.status).toBe(200);
    expect(resFullName.body.some((e: { email: string }) => e.email === 'searchable@jdconnect.com')).toBe(true);
  });

  it('GET /api/employees supports role_key and status filters', async () => {
    const res = await supertest(app)
      .get('/api/employees?role_key=super_admin&status=active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((e: { role?: string; employment_status: string }) => e.role === 'super_admin' && e.employment_status === 'active')).toBe(true);
  });

  describe('W-1004 Granular Permission Enforcement', () => {
    let managerToken: string;
    let targetEmpId: string;

    beforeEach(async () => {
      await pool.query("DELETE FROM employees WHERE email IN ('target.emp@jdconnect.com', 'forbidden@jdconnect.com')");
      await pool.query("DELETE FROM users WHERE email IN ('target.emp@jdconnect.com', 'forbidden@jdconnect.com')");

      const { privateKey } = await generateKeyPair('RS256');

      // Create Manager token (has employees.view, employees.filter.by_department, but NOT employees.create, NOT employees.filter.by_role, NOT employees.view.sensitive)
      managerToken = await new SignJWT({
        sub: '00000000-0000-0000-0000-000000000005',
        employee_id: '00000000-0000-0000-0000-000000000006',
        zulip_user_id: 3,
        roles: ['manager'],
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey as KeyLike);

      const roleRes = await pool.query("SELECT id FROM roles WHERE key = 'employee'");
      const empRoleId = roleRes.rows[0].id;

      const userRes = await pool.query("INSERT INTO users (email, password_hash) VALUES ('target.emp@jdconnect.com', 'hash') RETURNING id");
      const empRes = await pool.query(`
        INSERT INTO employees (auth_user_id, full_name, email, role_id, zulip_user_id, mobile, designation, zulip_provisioned)
        VALUES ($1, 'Target Emp', 'target.emp@jdconnect.com', $2, 9005, '9998887776', 'Agent', true)
        RETURNING id
      `, [userRes.rows[0].id, empRoleId]);
      targetEmpId = empRes.rows[0].id;
    });

    it('returns 403 when manager attempts to create employee (lacks employees.create)', async () => {
      const res = await supertest(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          full_name: 'Forbidden Emp',
          email: 'forbidden@jdconnect.com',
          password: 'Password123!',
          role_key: 'employee',
        });
      expect(res.status).toBe(403);
    });

    it('returns 403 when admin attempts to update role_key without employees.edit.role', async () => {
      // Create admin token (has employees.edit, employees.create, but NOT employees.edit.role)
      const { privateKey } = await generateKeyPair('RS256');
      const adminRoleOnlyToken = await new SignJWT({
        sub: '00000000-0000-0000-0000-000000000007',
        employee_id: '00000000-0000-0000-0000-000000000008',
        zulip_user_id: 4,
        roles: ['admin'],
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey as KeyLike);

      const res = await supertest(app)
        .patch(`/api/employees/${targetEmpId}`)
        .set('Authorization', `Bearer ${adminRoleOnlyToken}`)
        .send({ role_key: 'admin' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('employees.edit.role');
    });

    it('allows super_admin to update role_key', async () => {
      const res = await supertest(app)
        .patch(`/api/employees/${targetEmpId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role_key: 'manager' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('manager');
    });

    it('silently ignores role_key filter if caller lacks employees.filter.by_role', async () => {
      const res = await supertest(app)
        .get('/api/employees?role_key=super_admin')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      // Since manager lacks employees.filter.by_role, role_key filter is ignored, returning non-super_admin employees too
      const hasNonSuperAdmin = res.body.some((e: { role?: string }) => e.role !== 'super_admin');
      expect(hasNonSuperAdmin).toBe(true);
    });

    it('strips sensitive fields (mobile, designation, joining_date) when caller lacks employees.view.sensitive', async () => {
      const resManager = await supertest(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(resManager.status).toBe(200);
      const targetEmpManagerView = resManager.body.find((e: { email: string }) => e.email === 'target.emp@jdconnect.com');
      expect(targetEmpManagerView).toBeDefined();
      expect(targetEmpManagerView.mobile).toBeUndefined();
      expect(targetEmpManagerView.designation).toBeUndefined();

      const resAdmin = await supertest(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAdmin.status).toBe(200);
      const targetEmpAdminView = resAdmin.body.find((e: { email: string }) => e.email === 'target.emp@jdconnect.com');
      expect(targetEmpAdminView).toBeDefined();
      expect(targetEmpAdminView).toHaveProperty('mobile');
    });
  });
});


