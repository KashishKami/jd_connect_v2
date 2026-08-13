import { describe, it, expect, beforeAll } from 'vitest';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';

describe('Postgres Database Seeder Unit Test', () => {
  beforeAll(async () => {
    await runMigrations();
    await runSeed();
  });

  it('seeds 5 application roles', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM roles');
    expect(res.rows[0].count).toBe(5);
  });

  it('seeds 11 permission keys', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM permissions');
    expect(res.rows[0].count).toBe(11);
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
