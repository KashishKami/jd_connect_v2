import pool from '../lib/db';
import { CreateEmployeeInput, EmployeeResponse, EmployeeFilters } from '../types/employee';

export class EmployeeRepository {
  constructor(private dbPool = pool) {}

  async createEmployee(
    authUserId: string,
    data: CreateEmployeeInput
  ): Promise<EmployeeResponse> {
    const res = await this.dbPool.query<EmployeeResponse>(
      `INSERT INTO employees (
         auth_user_id, full_name, alias, email, mobile, department_id, role_id,
         centre_id, shift_id, team_leader_id, manager_id, designation, zulip_provisioned
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
       RETURNING *`,
      [
        authUserId,
        data.full_name.trim(),
        data.alias ? data.alias.trim() : null,
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
    const res = await this.dbPool.query<{ id: string }>('SELECT id FROM roles WHERE key = $1', [key]);
    return res.rows[0] || null;
  }

  async findAllEmployees(
    filters?: EmployeeFilters,
    dbClient = this.dbPool
  ): Promise<EmployeeResponse[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      conditions.push(`(e.full_name ILIKE $${params.length} OR e.alias ILIKE $${params.length})`);
    }

    if (filters?.department_id && filters.department_id.trim()) {
      params.push(filters.department_id.trim());
      conditions.push(`e.department_id = $${params.length}`);
    }

    if (filters?.role_key && filters.role_key.trim()) {
      params.push(filters.role_key.trim());
      conditions.push(`r.key = $${params.length}`);
    }

    if (filters?.status && filters.status.trim()) {
      params.push(filters.status.trim());
      conditions.push(`e.employment_status = $${params.length}::employment_status`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT e.*, d.name AS department, r.key AS role
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN roles r ON e.role_id = r.id
      ${whereClause}
      ORDER BY e.created_at DESC
    `;

    const res = await dbClient.query<EmployeeResponse>(sql, params);
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
    const res = await this.dbPool.query<EmployeeResponse>(
      `UPDATE employees
       SET zulip_user_id = $2, zulip_provisioned = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [employeeId, zulipUserId, provisioned]
    );
    return res.rows[0];
  }

  async updateEmployee(
    id: string,
    updates: Record<string, unknown>
  ): Promise<EmployeeResponse> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];

    const allowedColumns = [
      'full_name',
      'alias',
      'designation',
      'department_id',
      'role_id',
      'mobile',
      'employment_status',
      'shift_id',
      'centre_id',
    ];

    for (const key of allowedColumns) {
      if (key in updates) {
        params.push(updates[key] === undefined ? null : updates[key]);
        setClauses.push(`${key} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Employee not found');
      return existing;
    }

    setClauses.push('updated_at = NOW()');

    const sql = `
      WITH updated AS (
        UPDATE employees e
        SET ${setClauses.join(', ')}
        WHERE e.id = $1
        RETURNING *
      )
      SELECT u.*, d.name AS department, r.key AS role
      FROM updated u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
    `;

    const res = await this.dbPool.query<EmployeeResponse>(sql, params);
    return res.rows[0];
  }
}

export const employeeRepository = new EmployeeRepository();
