import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('POST /api/employees/:id/reset-password - Admin Password Reset', () => {
  let adminToken: string;
  let employeeToken: string;
  let superAdminRoleId: string;
  let targetEmployeeId: string;
  let targetEmail: string;

  beforeAll(async () => {
    await runMigrations();

    const roleRes = await pool.query("SELECT id FROM roles WHERE key = 'super_admin'");
    superAdminRoleId = roleRes.rows[0].id;

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
    await runSeed();

    targetEmail = 'target.employee@jdconnect.com';
    const createRes = await supertest(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Target Employee',
        email: targetEmail,
        password: 'OldPassword123!',
        role_id: superAdminRoleId,
      });

    expect(createRes.status).toBe(201);
    targetEmployeeId = createRes.body.id;
  });

  it('returns 403 Forbidden when called by user without hr.reset_password permission', async () => {
    const res = await supertest(app)
      .post(`/api/employees/${targetEmployeeId}/reset-password`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ new_password: 'NewPassword123!' });

    expect(res.status).toBe(403);
  });

  it('returns 404 Not Found for non-existent employee ID', async () => {
    const fakeId = '00000000-0000-0000-0000-999999999999';
    const res = await supertest(app)
      .post(`/api/employees/${fakeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'NewPassword123!' });

    expect(res.status).toBe(404);
  });

  it('resets employee password successfully when called by admin', async () => {
    const res = await supertest(app)
      .post(`/api/employees/${targetEmployeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'NewPassword123!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password updated successfully' });

    // Verify target employee cannot log in with old password
    const oldLogin = await supertest(app)
      .post('/api/auth/login')
      .send({ email: targetEmail, password: 'OldPassword123!' });
    expect(oldLogin.status).toBe(401);

    // Verify target employee can log in with new password
    const newLogin = await supertest(app)
      .post('/api/auth/login')
      .send({ email: targetEmail, password: 'NewPassword123!' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body).toHaveProperty('access_token');
  });
});
