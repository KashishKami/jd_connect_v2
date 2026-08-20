import pool from '../lib/db';

export interface DepartmentRow {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export class DepartmentRepository {
  constructor(private dbPool = pool) {}

  async listDepartments(): Promise<{ id: string; name: string }[]> {
    const res = await this.dbPool.query<{ id: string; name: string }>(
      'SELECT id, name FROM departments WHERE is_active = true ORDER BY name'
    );
    return res.rows;
  }
}

export const departmentRepository = new DepartmentRepository();
