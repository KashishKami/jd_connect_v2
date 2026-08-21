import pool from '../lib/db';
import { AttendanceRecord, AttendanceStatus } from '../types/attendance';

export interface FindAttendanceFilters {
  employee_id?: string | undefined;
  team_actor_id?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  status?: AttendanceStatus | undefined;
  search?: string | undefined;
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

  async findAnyOpenRecord(employeeId: string): Promise<AttendanceRecord | null> {
    const result = await pool.query(
      `SELECT * FROM attendance_records
       WHERE employee_id = $1 AND clock_out_at IS NULL
       ORDER BY clock_in_at DESC
       LIMIT 1`,
      [employeeId]
    );

    return result.rows[0] || null;
  }

  async findAllOpenRecords(): Promise<AttendanceRecord[]> {
    const result = await pool.query(
      `SELECT * FROM attendance_records
       WHERE clock_out_at IS NULL`
    );

    return result.rows;
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
      conditions.push(`a.employee_id = $${values.length}`);
    }
    if (filters.team_actor_id) {
      values.push(filters.team_actor_id);
      conditions.push(`(e.manager_id = $${values.length} OR e.team_leader_id = $${values.length} OR e.id = $${values.length})`);
    }
    if (filters.fromDate) {
      values.push(filters.fromDate);
      conditions.push(`a.work_date >= $${values.length}`);
    }
    if (filters.toDate) {
      values.push(filters.toDate);
      conditions.push(`a.work_date <= $${values.length}`);
    }
    if (filters.status) {
      if ((filters.status as string) === 'logged_in') {
        conditions.push(`a.clock_out_at IS NULL AND a.clock_in_at IS NOT NULL`);
      } else {
        values.push(filters.status);
        conditions.push(`a.status = $${values.length}`);
      }
    }
    if (filters.search) {
      values.push(`%${filters.search}%`);
      conditions.push(`(e.full_name ILIKE $${values.length} OR e.alias ILIKE $${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT a.*, COALESCE(e.alias, e.full_name) AS employee_name, e.full_name, e.alias, e.email AS employee_email, e.employee_code
      FROM attendance_records a
      LEFT JOIN employees e ON a.employee_id = e.id
      ${whereClause}
      ORDER BY a.work_date DESC, a.clock_in_at DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  async getLiveMonitorSummary(todayEST: string): Promise<{
    working_count: number;
    on_break_count: number;
    total_clocked_in: number;
  }> {
    const totalClockedInRes = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE work_date = $1 AND clock_out_at IS NULL`,
      [todayEST]
    );

    const onBreakRes = await pool.query(
      `SELECT COUNT(*) FROM break_records WHERE status = 'active'`
    );

    const totalClockedIn = parseInt(totalClockedInRes.rows[0].count, 10) || 0;
    const onBreakCount = parseInt(onBreakRes.rows[0].count, 10) || 0;
    const workingCount = Math.max(0, totalClockedIn - onBreakCount);

    return {
      working_count: workingCount,
      on_break_count: onBreakCount,
      total_clocked_in: totalClockedIn,
    };
  }

  async getTodaySummary(): Promise<{
    present: number;
    on_break: number;
    total_employees: number;
    late: number;
    half_day: number;
  }> {
    const todayESTRes = await pool.query(
      `SELECT (NOW() AT TIME ZONE 'America/New_York')::date AS today`
    );
    const todayEST = todayESTRes.rows[0].today;

    const presentRes = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE work_date = $1`,
      [todayEST]
    );

    const onBreakRes = await pool.query(
      `SELECT COUNT(*) FROM break_records WHERE status = 'active'`
    );

    const totalEmpRes = await pool.query(
      `SELECT COUNT(*) FROM employees WHERE employment_status = 'active'`
    );

    const lateRes = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE work_date = $1 AND status = 'late'`,
      [todayEST]
    );

    const halfDayRes = await pool.query(
      `SELECT COUNT(*) FROM attendance_records WHERE work_date = $1 AND status = 'half_day'`,
      [todayEST]
    );

    const present = parseInt(presentRes.rows[0].count, 10) || 0;
    const on_break = parseInt(onBreakRes.rows[0].count, 10) || 0;
    const total_employees = parseInt(totalEmpRes.rows[0].count, 10) || 0;
    const late = parseInt(lateRes.rows[0].count, 10) || 0;
    const half_day = parseInt(halfDayRes.rows[0].count, 10) || 0;

    return { present, on_break, total_employees, late, half_day };
  }
}

export const attendanceRepository = new AttendanceRepository();
