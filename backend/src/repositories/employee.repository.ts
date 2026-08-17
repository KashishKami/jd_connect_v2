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

  async findRoleByKey(key: string): Promise<{ id: string } | null> {
    const res = await pool.query<{ id: string }>('SELECT id FROM roles WHERE key = $1', [key]);
    return res.rows[0] || null;
  }

  async findAllEmployees(): Promise<EmployeeResponse[]> {
    const res = await pool.query<EmployeeResponse>(
      `SELECT e.*, d.name AS department, r.key AS role
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN roles r ON e.role_id = r.id
       ORDER BY e.created_at DESC`
    );
    return res.rows;
  }

  async findByZulipUserId(zulipUserId: number): Promise<EmployeeResponse | null> {
    const res = await pool.query<EmployeeResponse>(
      'SELECT * FROM employees WHERE zulip_user_id = $1',
      [zulipUserId]
    );
    return res.rows[0] || null;
  }

  async findByEmail(email: string): Promise<EmployeeResponse | null> {
    const res = await pool.query<EmployeeResponse>(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
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

  async updateZulipProvisioning(
    employeeId: string,
    zulipUserId: number | null,
    provisioned: boolean
  ): Promise<EmployeeResponse> {
    const res = await pool.query<EmployeeResponse>(
      `UPDATE employees
       SET zulip_user_id = $2, zulip_provisioned = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [employeeId, zulipUserId, provisioned]
    );
    return res.rows[0];
  }
}

export const employeeRepository = new EmployeeRepository();
