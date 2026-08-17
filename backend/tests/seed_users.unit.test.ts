import { describe, it, expect } from 'vitest';
import pool from '../src/lib/db';
import { runSeed } from '../scripts/seed';

describe('Sample Users Seeding Integration Test (W-653)', () => {
  it('seeds super_admin, employee, and manager test accounts into database', async () => {
    await runSeed();

    const usersRes = await pool.query('SELECT email FROM users ORDER BY email ASC');
    const emails = usersRes.rows.map((r) => r.email);

    expect(emails).toContain('admin@company.com');
    expect(emails).toContain('john.doe@jdconnect.com');
    expect(emails).toContain('jane.mgr@jdconnect.com');

    const empRes = await pool.query(`
      SELECT e.full_name, e.email, r.key as role_key
      FROM employees e
      JOIN roles r ON e.role_id = r.id
      WHERE e.email IN ('john.doe@jdconnect.com', 'jane.mgr@jdconnect.com')
    `);

    const empMap = new Map(empRes.rows.map((r) => [r.email, r]));
    expect(empMap.get('john.doe@jdconnect.com')?.role_key).toBe('employee');
    expect(empMap.get('jane.mgr@jdconnect.com')?.role_key).toBe('manager');
  });
});
