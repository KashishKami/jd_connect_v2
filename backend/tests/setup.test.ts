import { describe, it, expect } from 'vitest';
import pool from '../src/lib/db';

describe('Test Database Cleanup & Truncation Isolation', () => {
  it('truncates users table automatically before test run', async () => {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM users');
    expect(res.rows[0].count).toBe(0);
  });

  it('allows inserting dummy row and verifies cleanup in next test', async () => {
    await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ('test-isolation@jdconnect.com', 'hash123')"
    );
    const res = await pool.query('SELECT COUNT(*)::int as count FROM users');
    expect(res.rows[0].count).toBe(1);
  });
});
