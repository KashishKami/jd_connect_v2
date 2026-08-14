import pool from '../lib/db';
import { AttendanceRecord, AttendanceStatus } from '../types/attendance';

export interface FindAttendanceFilters {
  employee_id?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
}

export class AttendanceRepository {
  async findOpenRecord(employeeId: string, workDate: string): Promise<AttendanceRecord | null> {
    const result = await pool.query(
      `SELECT * FROM attendance_records
       WHERE employee_id = $1 AND work_date = $2 AND clock_out_at IS NULL`,
      [employeeId, workDate]
    );

    return result.rows[0] || null;
  }

  async createClockIn(employeeId: string, workDate: string, clockInAt: Date): Promise<AttendanceRecord> {
    const result = await pool.query(
      `INSERT INTO attendance_records (employee_id, work_date, clock_in_at, status, source)
       VALUES ($1, $2, $3, 'absent', 'auto')
       RETURNING *`,
      [employeeId, workDate, clockInAt]
    );

    return result.rows[0];
  }

  async updateClockOut(
    id: string,
    clockOutAt: Date,
    hoursWorked: number,
    status: AttendanceStatus,
    isLate: boolean
  ): Promise<AttendanceRecord> {
    const result = await pool.query(
      `UPDATE attendance_records
       SET clock_out_at = $1,
           hours_worked = $2,
           status = $3,
           is_late = $4,
           updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [clockOutAt, hoursWorked, status, isLate, id]
    );

    return result.rows[0];
  }

  async findRecords(filters: FindAttendanceFilters): Promise<AttendanceRecord[]> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (filters.employee_id) {
      values.push(filters.employee_id);
      conditions.push(`employee_id = $${values.length}`);
    }
    if (filters.fromDate) {
      values.push(filters.fromDate);
      conditions.push(`work_date >= $${values.length}`);
    }
    if (filters.toDate) {
      values.push(filters.toDate);
      conditions.push(`work_date <= $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM attendance_records ${whereClause} ORDER BY work_date DESC, clock_in_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  }
}

export const attendanceRepository = new AttendanceRepository();
