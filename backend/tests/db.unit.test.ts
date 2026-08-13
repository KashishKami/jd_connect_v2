import { describe, it, expect } from 'vitest';
import pool from '../src/lib/db';

describe('Database Connection Pool Unit Test', () => {
  it('executes SELECT 1 query successfully', async () => {
    const result = await pool.query('SELECT 1 as num');
    expect(result.rows[0].num).toBe(1);
  });
});
