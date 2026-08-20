import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('PATCH /api/employees/:id - Edit Employee & Password Reset', () => {
  let adminToken: string;
  let employeeToken: string;
  let targetEmployeeId: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();

    const { privateKey } = await generateKeyPair('RS256');

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

  beforeEach(async () => {
    const createRes = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Patch Target',
        alias: 'Target',
        email: 'patch.target@jdconnect.com',
        password: 'OriginalPassword123!',
        role_key: 'employee',
      });
    targetEmployeeId = createRes.body.id;
  });

  it('returns 403 when user lacks employees.manage permission', async () => {
    const res = await supertest(app)
      .patch(`/api/employees/${targetEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ alias: 'UpdatedAlias' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when body is empty', async () => {
    const res = await supertest(app)
      .patch(`/api/employees/${targetEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('updates alias and designation on valid payload', async () => {
    const res = await supertest(app)
      .patch(`/api/employees/${targetEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alias: 'Target Jr', designation: 'Senior Agent' });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('Target Jr');
    expect(res.body.designation).toBe('Senior Agent');
  });

  it('updates employment_status to suspended', async () => {
    const res = await supertest(app)
      .patch(`/api/employees/${targetEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employment_status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.employment_status).toBe('suspended');

    const dbRes = await pool.query('SELECT employment_status FROM employees WHERE id = $1', [targetEmployeeId]);
    expect(dbRes.rows[0].employment_status).toBe('suspended');
  });

  it('updates password when new_password provided', async () => {
    const res = await supertest(app)
      .patch(`/api/employees/${targetEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'BrandNewPassword123!' });

    expect(res.status).toBe(200);

    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'patch.target@jdconnect.com', password: 'BrandNewPassword123!' });

    expect(loginRes.status).toBe(200);
  });
});
