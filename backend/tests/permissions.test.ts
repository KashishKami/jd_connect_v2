import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { SignJWT } from 'jose';
import { getPrivateKey } from '../src/lib/keys';
import { runSeed } from '../scripts/seed';

async function generateTestToken(payload: { sub: string; employee_id: string; zulip_user_id: number; roles: string[] }) {
  const privateKey = await getPrivateKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);
}

describe('Permissions API Integration Test', () => {
  let employeeToken: string;
  let superAdminToken: string;
  let employeeId: string;
  let superAdminId: string;

  beforeAll(async () => {
    await runSeed();
    await pool.query("DELETE FROM employees WHERE email LIKE 'perm_%'");
    await pool.query("DELETE FROM users WHERE email LIKE 'perm_%'");
    // 1. Get role IDs
    const empRoleRes = await pool.query("SELECT id FROM roles WHERE key = 'employee'");
    const superRoleRes = await pool.query("SELECT id FROM roles WHERE key = 'super_admin'");
    const empRoleId = empRoleRes.rows[0].id;
    const superRoleId = superRoleRes.rows[0].id;

    // 2. Create users
    const user1 = await pool.query("INSERT INTO users (email, password_hash) VALUES ('perm_emp@test.com', 'hash') RETURNING id");
    const user2 = await pool.query("INSERT INTO users (email, password_hash) VALUES ('perm_super@test.com', 'hash') RETURNING id");

    // 3. Create employees
    const empRes = await pool.query(`
      INSERT INTO employees (auth_user_id, full_name, email, role_id, zulip_user_id, zulip_provisioned)
      VALUES ($1, 'Perm Emp', 'perm_emp@test.com', $2, 9001, true)
      RETURNING id
    `, [user1.rows[0].id, empRoleId]);
    employeeId = empRes.rows[0].id;

    const superRes = await pool.query(`
      INSERT INTO employees (auth_user_id, full_name, email, role_id, zulip_user_id, zulip_provisioned)
      VALUES ($1, 'Perm Super', 'perm_super@test.com', $2, 9002, true)
      RETURNING id
    `, [user2.rows[0].id, superRoleId]);
    superAdminId = superRes.rows[0].id;

    // 4. Generate JWT tokens
    employeeToken = await generateTestToken({
      sub: user1.rows[0].id,
      employee_id: employeeId,
      zulip_user_id: 9001,
      roles: ['employee'],
    });

    superAdminToken = await generateTestToken({
      sub: user2.rows[0].id,
      employee_id: superAdminId,
      zulip_user_id: 9002,
      roles: ['super_admin'],
    });
  });

  describe('GET /api/me/permissions', () => {
    it('returns 401 if no Authorization header is provided', async () => {
      const res = await request(app).get('/api/me/permissions');
      expect(res.status).toBe(401);
    });

    it('returns permissions for employee role', async () => {
      const res = await request(app)
        .get('/api/me/permissions')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.header['cache-control']).toContain('no-store');
      expect(Array.isArray(res.body.permissions)).toBe(true);

      const perms: string[] = res.body.permissions;
      expect(perms).toContain('portal.attendance');
      expect(perms).toContain('attendance.view_own');
      expect(perms).not.toContain('employees.create');
      expect(perms).not.toContain('permissions.manage');
    });

    it('returns all 26 permissions for super_admin role', async () => {
      const res = await request(app)
        .get('/api/me/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.permissions)).toBe(true);
      expect(res.body.permissions.length).toBe(26);
      expect(res.body.permissions).toContain('portal.permissions');
      expect(res.body.permissions).toContain('permissions.manage');
    });
  });

  describe('GET /api/permissions', () => {
    it('returns 403 if caller lacks permissions.view', async () => {
      const res = await request(app)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    it('returns all 26 permissions with descriptions for super_admin', async () => {
      const res = await request(app)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(26);
      expect(res.body[0]).toHaveProperty('key');
      expect(res.body[0]).toHaveProperty('description');
    });
  });

  describe('GET /api/roles', () => {
    it('returns 403 if caller lacks permissions.view', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    it('returns roles with permission sets for super_admin', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);

      const adminRole = res.body.find((r: { key: string }) => r.key === 'admin');
      expect(adminRole).toBeDefined();
      expect(Array.isArray(adminRole.permissions)).toBe(true);
    });
  });

  describe('PUT /api/roles/:roleKey/permissions', () => {
    it('returns 403 if caller attempts to update super_admin role', async () => {
      const res = await request(app)
        .put('/api/roles/super_admin/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ permissions: ['portal.attendance'] });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('super_admin');
    });

    it('returns 400 if body contains an invalid permission key', async () => {
      const res = await request(app)
        .put('/api/roles/admin/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ permissions: ['invalid.unknown.key'] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unknown permission key');
    });

    it('updates role permissions successfully for admin', async () => {
      const newPerms = ['portal.attendance', 'attendance.view_own'];
      const putRes = await request(app)
        .put('/api/roles/admin/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ permissions: newPerms });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/roles/admin/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.permissions.sort()).toEqual(newPerms.sort());
    });
  });
});
