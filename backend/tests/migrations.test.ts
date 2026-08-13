import { describe, it, expect, beforeAll } from 'vitest';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';

describe('Postgres Database Migrations Integration Test', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('creates all required domain tables in Postgres schema', async () => {
    const res = await pool.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = res.rows.map((r) => r.table_name);

    expect(tables).toContain('users');
    expect(tables).toContain('roles');
    expect(tables).toContain('permissions');
    expect(tables).toContain('role_permissions');
    expect(tables).toContain('departments');
    expect(tables).toContain('centres');
    expect(tables).toContain('shifts');
    expect(tables).toContain('employees');
    expect(tables).toContain('employee_sessions');
    expect(tables).toContain('break_types');
    expect(tables).toContain('break_policies');
    expect(tables).toContain('attendance_records');
    expect(tables).toContain('attendance_corrections');
    expect(tables).toContain('attendance_audit_logs');
    expect(tables).toContain('break_records');
    expect(tables).toContain('break_requests');
    expect(tables).toContain('break_audit_logs');
    expect(tables).toContain('audit_logs');

    const colRes = await pool.query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employees'
    `);
    const colMap = new Map(colRes.rows.map((r) => [r.column_name, r.data_type]));

    expect(colMap.has('zulip_user_id')).toBe(true);
    expect(colMap.get('zulip_user_id')).toBe('integer');
    expect(colMap.has('rocketchat_user_id')).toBe(false);
    expect(colMap.has('zulip_provisioned')).toBe(true);
    expect(colMap.has('rc_provisioned')).toBe(false);
  });
});
