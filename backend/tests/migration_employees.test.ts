import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { migrateEmployees } from '../scripts/migrate-employees';
import bcrypt from 'bcryptjs';

describe('Employee Data Migration (W-701)', () => {
  const tempDumpPath = path.resolve(__dirname, 'temp_mock_employees_dump.sql');

  const mockDumpSql = `
-- Mock SQL Dump
COPY public.departments (id, name, description, is_active, created_at, updated_at) FROM stdin;
ded32052-ed24-499c-921d-e1ce331605e9	Sales	\\N	t	2026-06-13 22:25:19.053134+00	2026-06-13 22:25:19.053134+00
818a8b22-2ca5-49a5-9c36-87d16f9f9f80	Backend	\\N	t	2026-06-13 22:25:19.053134+00	2026-06-13 22:25:19.053134+00
60e7c523-7239-4c70-a6e0-6d2d700cbfba	ML Team	\\N	t	2026-06-15 20:07:28.045981+00	2026-06-15 20:07:28.045981+00
\\.

COPY public.centres (id, code, name, is_active, created_at, updated_at) FROM stdin;
210a4ce8-d87b-4448-8009-5766c5a7d92d	DBP	Doon Business Park	t	2026-06-13 22:25:19.053134+00	2026-06-13 22:25:19.053134+00
e278c2e1-92b5-4c82-a17c-b4c2c0c2a21e	ALEX	Alex	t	2026-06-15 22:14:00.605159+00	2026-06-15 22:14:00.605159+00
\\.

COPY public.shifts (id, name, start_time, end_time, grace_minutes, is_active, created_at, updated_at) FROM stdin;
cd57fef4-9718-4b66-a603-717279df8c4f	Night Shift	19:30:00	04:30:00	15	t	2026-06-13 22:25:19.053134+00	2026-06-13 22:25:19.053134+00
eb3e1eba-8a85-47f4-a6a4-f42acf144a86	Day Shift	09:30:00	18:30:00	15	t	2026-06-26 19:24:52.228657+00	2026-06-26 19:24:52.228657+00
\\.

COPY public.roles (id, key, name, description, created_at, is_system, key_text) FROM stdin;
d70503d5-055f-4340-97bb-71e9cbbad05f	employee	Employee	Standard employee access	2026-06-13 22:25:19.053134+00	t	employee
b891fc49-45ee-4362-9608-7a5a0d23f8a8	hr	HR	Human Resources	2026-06-16 17:49:15.360823+00	t	hr
\\.

COPY public.employees (id, auth_user_id, employee_code, full_name, email, mobile, department_id, role_id, team_leader_id, manager_id, centre_id, shift_id, designation, joining_date, employment_status, profile_photo_url, created_at, updated_at, alias_name, approval_status, profile_completed, username) FROM stdin;
emp_001_uuid	auth_001_uuid	JD0901	Legacy HR Person	legacy.hr@company.com	1234567890	ded32052-ed24-499c-921d-e1ce331605e9	b891fc49-45ee-4362-9608-7a5a0d23f8a8	\\N	\\N	210a4ce8-d87b-4448-8009-5766c5a7d92d	cd57fef4-9718-4b66-a603-717279df8c4f	HR Specialist	2024-10-23	active	\\N	2026-06-19 04:40:23+00	2026-06-25 13:28:12+00	Abhishek	approved	t	legacyhr
emp_002_uuid	auth_002_uuid	JD0902	Legacy Employee	legacy.emp@company.com	9876543210	818a8b22-2ca5-49a5-9c36-87d16f9f9f80	d70503d5-055f-4340-97bb-71e9cbbad05f	\\N	emp_001_uuid	210a4ce8-d87b-4448-8009-5766c5a7d92d	cd57fef4-9718-4b66-a603-717279df8c4f	Developer	2024-10-24	active	\\N	2026-06-19 04:40:23+00	2026-06-25 13:28:12+00	Emp2	approved	t	legacyemp
\\.
`;

  beforeAll(async () => {
    // Clear and run base schema migrations and seeds
    await runMigrations();
    await runSeed();
    fs.writeFileSync(tempDumpPath, mockDumpSql, 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(tempDumpPath)) {
      fs.unlinkSync(tempDumpPath);
    }
  });

  it('migrates employees successfully with proper password hashing and first-class hr role', async () => {
    // Mock Zulip API calls
    let fetchCallCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      fetchCallCount++;
      return {
        ok: true,
        json: async () => ({
          result: 'success',
          user_id: fetchCallCount === 1 ? 501 : 502,
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Run employee migration
    const summary = await migrateEmployees(tempDumpPath);

    // Verify migration summary stats
    expect(summary.totalEmployees).toBe(2);
    expect(summary.migratedCount).toBe(2);
    expect(summary.zulipProvisionedCount).toBe(2);

    // 1. Verify User credentials exist and are active
    const usersRes = await pool.query('SELECT * FROM users ORDER BY email ASC');
    // Note: seed.ts already seeded admin@company.com, john.doe@jdconnect.com, jane.mgr@jdconnect.com
    // Our migration inserted legacy.hr@company.com and legacy.emp@company.com
    const migratedUsers = usersRes.rows.filter(u => u.email.startsWith('legacy.'));
    expect(migratedUsers.length).toBe(2);

    const hrUser = migratedUsers.find(u => u.email === 'legacy.hr@company.com');
    const empUser = migratedUsers.find(u => u.email === 'legacy.emp@company.com');
    expect(hrUser).toBeDefined();
    expect(empUser).toBeDefined();

    // Verify password hashing matches TempPass@{last4charsOfOldAuthUserID}!
    // auth_001_uuid last 4 chars = uuid
    const expectedHrPass = 'TempPass@uuid!';
    const expectedEmpPass = 'TempPass@uuid!';
    expect(await bcrypt.compare(expectedHrPass, hrUser.password_hash)).toBe(true);
    expect(await bcrypt.compare(expectedEmpPass, empUser.password_hash)).toBe(true);

    // 2. Verify Employee records and relationship mapping
    const empProfilesRes = await pool.query(`
      SELECT e.*, r.key as role_key, d.name as department_name, c.code as centre_code, s.name as shift_name
      FROM employees e
      JOIN roles r ON e.role_id = r.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN centres c ON e.centre_id = c.id
      LEFT JOIN shifts s ON e.shift_id = s.id
      ORDER BY e.email ASC
    `);
    const migratedEmps = empProfilesRes.rows.filter(e => e.email.startsWith('legacy.'));
    expect(migratedEmps.length).toBe(2);

    const hrEmp = migratedEmps.find(e => e.email === 'legacy.hr@company.com');
    const normalEmp = migratedEmps.find(e => e.email === 'legacy.emp@company.com');

    // System roles verification
    expect(hrEmp.role_key).toBe('hr'); // First-class HR role
    expect(normalEmp.role_key).toBe('employee');

    // Designation and profile details
    expect(hrEmp.designation).toBe('HR Specialist');
    expect(normalEmp.designation).toBe('Developer');
    expect(hrEmp.employee_code).toBe('JD0901');
    expect(normalEmp.employee_code).toBe('JD0902');

    // Shift and Centre mapping
    expect(hrEmp.centre_code).toBe('DBP');
    expect(hrEmp.shift_name).toBe('Night Shift');

    // Zulip provisioning mapping
    expect(hrEmp.zulip_provisioned).toBe(true);
    expect(hrEmp.zulip_user_id).toBe(501);
    expect(normalEmp.zulip_provisioned).toBe(true);
    expect(normalEmp.zulip_user_id).toBe(502);

    // Hierarchical reports-to mapping (normalEmp reports to hrEmp)
    expect(normalEmp.manager_id).toBe(hrEmp.id);
  });
});
