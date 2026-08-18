import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { migrateAttendance } from '../scripts/migrate-attendance';

describe('Attendance Data Migration (W-702)', () => {
  const tempDumpPath = path.resolve(__dirname, 'temp_mock_attendance_dump.sql');

  // We mock two employees:
  // emp1: legacy ID = emp1_legacy_uuid, email = legacy.emp1@company.com
  // emp2: legacy ID = emp2_legacy_uuid, email = legacy.emp2@company.com
  // We mock the break_types:
  // bio: legacy ID = 83ffefc7-1b64-4f5f-88be-c554d87624dd, key = bio
  const mockDumpSql = `
-- Mock SQL Dump
COPY public.employees (id, email, full_name, employee_code) FROM stdin;
a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1	legacy.emp1@company.com	Employee One	JD0901
b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2	legacy.emp2@company.com	Employee Two	JD0902
\\.

COPY public.break_types (id, key, name) FROM stdin;
83ffefc7-1b64-4f5f-88be-c554d87624dd	bio	Bio Break
\\.

COPY public.attendance_records (id, employee_id, work_date, login_at, logout_at, hours_worked, status, is_late, source, notes, created_at, updated_at) FROM stdin;
11111111-1111-1111-1111-111111111111	a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1	2026-06-15	2026-06-15 09:10:00-05	2026-06-15 18:15:00-05	9.083333333333334	present	f	auto	Regular shift	2026-06-15 18:15:00+00	2026-06-15 18:15:00+00
22222222-2222-2222-2222-222222222222	b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2	2026-06-15	2026-06-15 09:50:00-05	2026-06-15 18:00:00-05	8.166666666666667	late	t	auto	Late clock in	2026-06-15 14:00:00+00	2026-06-15 14:00:00+00
\\.

COPY public.break_records (id, employee_id, break_type_id, department_id, centre_id, start_at, end_at, duration_minutes, status, limit_minutes, notes, created_at, updated_at) FROM stdin;
33333333-3333-3333-3333-333333333333	a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1	83ffefc7-1b64-4f5f-88be-c554d87624dd	\\N	\\N	2026-06-15 11:00:00-05	2026-06-15 11:08:00-05	8	completed	10	Coffee break	2026-06-15 11:08:00+00	2026-06-15 11:08:00+00
44444444-4444-4444-4444-444444444444	b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2	83ffefc7-1b64-4f5f-88be-c554d87624dd	\\N	\\N	2026-06-15 13:00:00-05	2026-06-15 13:15:00-05	15	exceeded	10	Exceeded break limit	2026-06-15 13:15:00+00	2026-06-15 13:15:00+00
\\.
`;

  let newEmp1Id: string;
  let newEmp2Id: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();
    fs.writeFileSync(tempDumpPath, mockDumpSql, 'utf-8');
  });

  afterAll(async () => {
    if (fs.existsSync(tempDumpPath)) {
      fs.unlinkSync(tempDumpPath);
    }
  });

  it('migrates attendance and break records correctly with idempotency', async () => {
    // Seed mock employees in the new database so we can match them by email
    const userRes1 = await pool.query(
      "INSERT INTO users (email, password_hash, is_active) VALUES ('legacy.emp1@company.com', 'hashed', true) RETURNING id"
    );
    const empRes1 = await pool.query(
      `INSERT INTO employees (auth_user_id, employee_code, full_name, email, employment_status)
       VALUES ($1, 'JD0901', 'Employee One', 'legacy.emp1@company.com', 'active') RETURNING id`,
      [userRes1.rows[0].id]
    );
    newEmp1Id = empRes1.rows[0].id;

    const userRes2 = await pool.query(
      "INSERT INTO users (email, password_hash, is_active) VALUES ('legacy.emp2@company.com', 'hashed', true) RETURNING id"
    );
    const empRes2 = await pool.query(
      `INSERT INTO employees (auth_user_id, employee_code, full_name, email, employment_status)
       VALUES ($1, 'JD0902', 'Employee Two', 'legacy.emp2@company.com', 'active') RETURNING id`,
      [userRes2.rows[0].id]
    );
    newEmp2Id = empRes2.rows[0].id;

    // Run migration
    const summary = await migrateAttendance(tempDumpPath);

    expect(summary.attendanceCount).toBe(2);
    expect(summary.breakCount).toBe(2);

    // Verify attendance records mapped correctly
    const attRes = await pool.query('SELECT * FROM attendance_records ORDER BY work_date ASC, employee_id ASC');
    // Seed might have attendance, let's filter by our migrated employees
    const migratedAtts = attRes.rows.filter(
      (a) => a.employee_id === newEmp1Id || a.employee_id === newEmp2Id
    );

    expect(migratedAtts.length).toBe(2);

    const att1 = migratedAtts.find((a) => a.employee_id === newEmp1Id);
    const att2 = migratedAtts.find((a) => a.employee_id === newEmp2Id);

    expect(att1).toBeDefined();
    expect(att2).toBeDefined();

    // Map check: login_at -> clock_in_at
    expect(new Date(att1.clock_in_at).toISOString()).toContain('2026-06-15T14:10:00'); // EST conversion check
    expect(att1.status).toBe('present');
    expect(att2.status).toBe('late');
    expect(att2.is_late).toBe(true);

    // Verify break records mapped correctly
    const brkRes = await pool.query('SELECT * FROM break_records ORDER BY start_at ASC');
    const migratedBrks = brkRes.rows.filter(
      (b) => b.employee_id === newEmp1Id || b.employee_id === newEmp2Id
    );

    expect(migratedBrks.length).toBe(2);

    const brk1 = migratedBrks.find((b) => b.employee_id === newEmp1Id);
    const brk2 = migratedBrks.find((b) => b.employee_id === newEmp2Id);

    expect(brk1).toBeDefined();
    expect(brk2).toBeDefined();

    // Verify break type key mapped to new UUID
    const bioTypeRes = await pool.query("SELECT id FROM break_types WHERE key = 'bio'");
    const newBioTypeId = bioTypeRes.rows[0].id;
    expect(brk1.break_type_id).toBe(newBioTypeId);
    expect(parseFloat(brk1.duration_minutes)).toBe(8);
    expect(brk1.status).toBe('completed');
    expect(brk2.status).toBe('exceeded');

    // Run migration again to check idempotency (should succeed and not duplicate)
    const summary2 = await migrateAttendance(tempDumpPath);
    expect(summary2.attendanceCount).toBe(2);
    expect(summary2.breakCount).toBe(2);

    const countRes = await pool.query('SELECT COUNT(*) FROM attendance_records WHERE employee_id IN ($1, $2)', [
      newEmp1Id,
      newEmp2Id,
    ]);
    expect(parseInt(countRes.rows[0].count)).toBe(2);
  });
});
