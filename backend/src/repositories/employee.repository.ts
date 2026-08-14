import pool from '../lib/db';
import { CreateEmployeeInput, EmployeeResponse } from '../types/employee';

export class EmployeeRepository {
  async createEmployee(
    authUserId: string,
    data: CreateEmployeeInput
  ): Promise<EmployeeResponse> {
    const res = await pool.query<EmployeeResponse>(
      `INSERT INTO employees (
         auth_user_id, full_name, email, mobile, department_id, role_id,
         centre_id, shift_id, team_leader_id, manager_id, designation, zulip_provisioned
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
       RETURNING *`,
      [
        authUserId,
        data.full_name.trim(),
        data.email.toLowerCase().trim(),
        data.mobile || null,
        data.department_id || null,
        data.role_id || null,
        data.centre_id || null,
        data.shift_id || null,
        data.team_leader_id || null,
        data.manager_id || null,
        data.designation || null,
      ]
    );
    return res.rows[0];
  }

  async findByZulipUserId(zulipUserId: number): Promise<EmployeeResponse | null> {
    const res = await pool.query<EmployeeResponse>(
      'SELECT * FROM employees WHERE zulip_user_id = $1',
      [zulipUserId]
    );
    return res.rows[0] || null;
  }

  async findById(id: string): Promise<EmployeeResponse | null> {
    const res = await pool.query<EmployeeResponse>(
      'SELECT * FROM employees WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }
}

export const employeeRepository = new EmployeeRepository();
