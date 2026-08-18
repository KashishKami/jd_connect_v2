/* eslint-disable no-console */
import pool from '../src/lib/db';
import { parseSqlDump } from '../src/lib/copy-parser';
import { computeAttendanceStatus } from '../src/services/attendance.service';

export interface AttendanceMigrationSummary {
  attendanceCount: number;
  breakCount: number;
}

export async function migrateAttendance(dumpFilePath: string): Promise<AttendanceMigrationSummary> {
  console.log(`Starting attendance migration from: ${dumpFilePath}`);
  const data = await parseSqlDump(dumpFilePath);

  const legacyEmployees = data['employees'] || [];
  const legacyBreakTypes = data['break_types'] || [];
  const legacyAttendance = data['attendance_records'] || [];
  const legacyBreaks = data['break_records'] || [];

  const client = await pool.connect();
  const summary: AttendanceMigrationSummary = {
    attendanceCount: 0,
    breakCount: 0,
  };

  try {
    // 1. Map old employee UUIDs to new employee UUIDs
    const legacyEmpEmailMap: Record<string, string> = {}; // oldUUID -> email
    for (const le of legacyEmployees) {
      if (le.id && le.email) {
        legacyEmpEmailMap[le.id] = le.email.toLowerCase().trim();
      }
    }

    const newEmpRes = await client.query('SELECT id, email, shift_id FROM employees');
    const newEmpEmailMap: Record<string, { id: string; shiftId: string | null }> = {};
    for (const ne of newEmpRes.rows) {
      newEmpEmailMap[ne.email.toLowerCase().trim()] = { id: ne.id, shiftId: ne.shift_id };
    }

    const empMap: Record<string, string> = {}; // oldEmployeeUUID -> newEmployeeUUID
    const empShiftMap: Record<string, string | null> = {}; // newEmployeeUUID -> shiftId
    console.log('Legacy Emails Map:', JSON.stringify(legacyEmpEmailMap));
    console.log('New Emails Map:', JSON.stringify(newEmpEmailMap));
    for (const [oldId, email] of Object.entries(legacyEmpEmailMap)) {
      const match = newEmpEmailMap[email];
      if (match) {
        empMap[oldId] = match.id;
        empShiftMap[match.id] = match.shiftId;
      }
    }

    // Load shifts start times
    const shiftRes = await client.query('SELECT id, start_time FROM shifts');
    const shiftStartMap: Record<string, string> = {}; // shiftId -> start_time
    for (const s of shiftRes.rows) {
      shiftStartMap[s.id] = s.start_time;
    }

    // 2. Map break types
    const btRes = await client.query('SELECT id, key FROM break_types');
    const newBtKeyMap: Record<string, string> = {}; // key -> newUUID
    for (const bt of btRes.rows) {
      newBtKeyMap[bt.key] = bt.id;
    }

    const btMap: Record<string, string> = {}; // oldBtUUID -> newBtUUID
    for (const lbt of legacyBreakTypes) {
      if (lbt.id && lbt.key) {
        const match = newBtKeyMap[lbt.key];
        if (match) {
          btMap[lbt.id] = match;
        }
      }
    }

    // 3. Migrate Attendance records
    await client.query('BEGIN');

    for (const la of legacyAttendance) {
      const newEmpId = empMap[la.employee_id!];
      if (!newEmpId) {
        console.warn(`Skipping attendance record ${la.id}: employee not found in map.`);
        continue;
      }

      const clockInAt = la.login_at ? new Date(la.login_at) : null;
      const clockOutAt = la.logout_at ? new Date(la.logout_at) : null;
      const workDate = la.work_date!;

      if (!clockInAt) continue;

      // Recalculate status and lateness using computeAttendanceStatus
      const shiftId = empShiftMap[newEmpId];
      const shiftStartTimeStr = (shiftId ? shiftStartMap[shiftId] : null) || '09:30:00';
      const shiftStartEST = new Date(`${workDate}T${shiftStartTimeStr}-05:00`); // EST offset

      let hoursWorked = la.hours_worked ? parseFloat(la.hours_worked) : 0;
      if (hoursWorked === 0 && clockOutAt) {
        hoursWorked = (clockOutAt.getTime() - clockInAt.getTime()) / (1000 * 60 * 60);
      }

      const { status, isLate } = computeAttendanceStatus(clockInAt, shiftStartEST, hoursWorked);

      const checkRes = await client.query(
        'SELECT id FROM attendance_records WHERE employee_id = $1 AND work_date = $2',
        [newEmpId, workDate]
      );

      if (checkRes.rows.length > 0) {
        await client.query(
          `UPDATE attendance_records
           SET clock_in_at = $1, clock_out_at = $2, hours_worked = $3, status = $4, is_late = $5,
               source = $6, notes = $7, updated_at = NOW()
           WHERE id = $8`,
          [
            clockInAt,
            clockOutAt,
            hoursWorked,
            status,
            isLate,
            la.source || 'auto',
            la.notes || null,
            checkRes.rows[0].id,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO attendance_records (id, employee_id, work_date, clock_in_at, clock_out_at, hours_worked, status, is_late, source, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            la.id,
            newEmpId,
            workDate,
            clockInAt,
            clockOutAt,
            hoursWorked,
            status,
            isLate,
            resolveAttendanceSource(la.source),
            la.notes || null,
            la.created_at ? new Date(la.created_at) : new Date(),
            la.updated_at ? new Date(la.updated_at) : new Date(),
          ]
        );
      }
      summary.attendanceCount++;
    }

    // 4. Migrate Break records
    for (const lb of legacyBreaks) {
      const newEmpId = empMap[lb.employee_id!];
      if (!newEmpId) continue;

      const newBtId = btMap[lb.break_type_id!];
      if (!newBtId) continue;

      const startAt = lb.start_at ? new Date(lb.start_at) : null;
      const endAt = lb.end_at ? new Date(lb.end_at) : null;
      if (!startAt) continue;

      const duration = lb.duration_minutes ? parseInt(lb.duration_minutes) : 0;
      const limit = lb.limit_minutes ? parseInt(lb.limit_minutes) : 0;
      const status = resolveBreakStatus(lb.status);

      const checkRes = await client.query(
        'SELECT id FROM break_records WHERE employee_id = $1 AND start_at = $2',
        [newEmpId, startAt]
      );

      if (checkRes.rows.length > 0) {
        await client.query(
          `UPDATE break_records
           SET break_type_id = $1, end_at = $2, duration_minutes = $3, status = $4, limit_minutes = $5, notes = $6, updated_at = NOW()
           WHERE id = $7`,
          [
            newBtId,
            endAt,
            duration,
            status,
            limit,
            lb.notes || null,
            checkRes.rows[0].id,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO break_records (id, employee_id, break_type_id, start_at, end_at, duration_minutes, status, limit_minutes, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            lb.id,
            newEmpId,
            newBtId,
            startAt,
            endAt,
            duration,
            status,
            limit,
            lb.notes || null,
            lb.created_at ? new Date(lb.created_at) : new Date(),
            lb.updated_at ? new Date(lb.updated_at) : new Date(),
          ]
        );
      }
      summary.breakCount++;
    }

    await client.query('COMMIT');
    console.log('Attendance & Break migration completed successfully.');
    return summary;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Attendance migration script failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export function resolveBreakStatus(status: string | null): string {
  const valid = ['active', 'completed', 'exceeded', 'cancelled'];
  return valid.includes(status || '') ? status! : 'completed';
}

export function resolveAttendanceSource(source: string | null): string {
  const valid = ['auto', 'manual', 'correction'];
  return valid.includes(source || '') ? source! : 'auto';
}

if (require.main === module) {
  const dumpPath = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\jdconnect_public_data.sql';
  migrateAttendance(dumpPath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
