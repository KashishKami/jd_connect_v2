import { describe, it, expect, beforeAll } from 'vitest';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';

describe('Postgres Database Seeder Unit Test', () => {
  beforeAll(async () => {
    await runMigrations();
    // Truncate reference tables to ensure isolation from other integration tests
    await pool.query('TRUNCATE roles, permissions, role_permissions, departments, centres, shifts, break_types CASCADE');
    await runSeed();
  });

  it('seeds 6 application roles', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM roles');
    expect(res.rows[0].count).toBe(6);
  });

  it('seeds 26 permission keys', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM permissions');
    expect(res.rows[0].count).toBe(26);
  });

  it('seeds 7 departments', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM departments');
    expect(res.rows[0].count).toBe(7);
  });

  it('seeds 2 office centres (DBP, ITP)', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM centres');
    expect(res.rows[0].count).toBe(2);
  });

  it('seeds 5 break types (bio, tea, dinner, smoke, meeting)', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM break_types');
    expect(res.rows[0].count).toBe(5);
  });
});
