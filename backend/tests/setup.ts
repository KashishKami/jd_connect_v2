import { beforeAll, beforeEach, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('jdconnect_test')) {
    process.env.DATABASE_URL = 'postgres://jduser:jdpassword@127.0.0.1:5432/jdconnect_test';
  }
  await runMigrations();
});

beforeEach(async () => {
  // Truncate domain data between tests while preserving seeded lookup tables
  await pool.query(`
    TRUNCATE users, employees, employee_sessions, 
             attendance_records, attendance_corrections, attendance_audit_logs,
             break_records, break_requests, break_audit_logs, audit_logs CASCADE
  `);
});

afterAll(async () => {
  if (!pool.ended) {
    await pool.end();
  }
});
