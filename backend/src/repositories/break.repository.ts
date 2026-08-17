import pool from '../lib/db';
import { BreakRecord, BreakStatus, BreakType } from '../types/break';

export interface FindBreakFilters {
  employee_id?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  status?: BreakStatus | undefined;
}

export class BreakRepository {
  async findActiveBreak(employeeId: string): Promise<BreakRecord | null> {
    const result = await pool.query(
      `SELECT * FROM break_records
       WHERE employee_id = $1 AND status = 'active'`,
      [employeeId]
    );

    return result.rows[0] || null;
  }

  async findBreakTypeByKey(key: string): Promise<BreakType | null> {
    const result = await pool.query(
      `SELECT * FROM break_types WHERE key = $1 AND is_active = true`,
      [key]
    );

    return result.rows[0] || null;
  }

  async listBreakTypes(isActive = true): Promise<BreakType[]> {
    const result = await pool.query(
      `SELECT * FROM break_types WHERE is_active = $1 ORDER BY default_limit_minutes ASC NULLS LAST`,
      [isActive]
    );

    return result.rows;
  }

  async getEffectiveLimit(
    breakTypeId: string,
    centreId?: string | null | undefined,
    departmentId?: string | null | undefined
  ): Promise<number | null> {
    if (centreId || departmentId) {
      const policyRes = await pool.query(
        `SELECT limit_minutes FROM break_policies
         WHERE break_type_id = $1
           AND is_active = true
           AND (centre_id = $2 OR centre_id IS NULL)
           AND (department_id = $3 OR department_id IS NULL)
         ORDER BY centre_id IS NOT NULL DESC, department_id IS NOT NULL DESC
         LIMIT 1`,
        [breakTypeId, centreId || null, departmentId || null]
      );

      if (policyRes.rows.length > 0 && policyRes.rows[0].limit_minutes !== null) {
        return policyRes.rows[0].limit_minutes;
      }
    }

    const typeRes = await pool.query(
      `SELECT default_limit_minutes FROM break_types WHERE id = $1`,
      [breakTypeId]
    );

    return typeRes.rows[0]?.default_limit_minutes ?? null;
  }

  async createBreak(data: {
    employee_id: string;
    break_type_id: string;
    department_id?: string | null | undefined;
    centre_id?: string | null | undefined;
    limit_minutes: number | null;
  }): Promise<BreakRecord> {
    const result = await pool.query(
      `INSERT INTO break_records (employee_id, break_type_id, department_id, centre_id, limit_minutes, status, start_at)
       VALUES ($1, $2, $3, $4, $5, 'active', now())
       RETURNING *`,
      [
        data.employee_id,
        data.break_type_id,
        data.department_id || null,
        data.centre_id || null,
        data.limit_minutes,
      ]
    );

    return result.rows[0];
  }

  async updateEndBreak(
    id: string,
    endAt: Date,
    durationMinutes: number,
    status: BreakStatus
  ): Promise<BreakRecord> {
    const result = await pool.query(
      `UPDATE break_records
       SET end_at = $1,
           duration_minutes = $2,
           status = $3,
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [endAt, durationMinutes, status, id]
    );

    return result.rows[0];
  }

  async findRecords(filters: FindBreakFilters): Promise<BreakRecord[]> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (filters.employee_id) {
      values.push(filters.employee_id);
      conditions.push(`br.employee_id = $${values.length}`);
    }
    if (filters.fromDate) {
      values.push(filters.fromDate);
      conditions.push(`br.start_at >= $${values.length}`);
    }
    if (filters.toDate) {
      values.push(filters.toDate);
      conditions.push(`br.start_at <= $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`br.status = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT br.*, e.full_name AS employee_name, e.email AS employee_email, bt.name AS break_name, bt.key AS break_type_key
      FROM break_records br
      LEFT JOIN employees e ON br.employee_id = e.id
      LEFT JOIN break_types bt ON br.break_type_id = bt.id
      ${whereClause}
      ORDER BY br.start_at DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }
}

export const breakRepository = new BreakRepository();
