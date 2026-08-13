import pool from '../lib/db';
import { AuthUserDetail } from '../types/auth';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository {
  async findByEmail(email: string): Promise<UserRow | null> {
    const res = await pool.query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  }

  async findAuthUserByEmail(email: string): Promise<AuthUserDetail | null> {
    const res = await pool.query<{
      id: string;
      email: string;
      password_hash: string;
      is_active: boolean;
      employee_id: string;
      rocketchat_user_id: string | null;
      employment_status: string;
      role_key: string;
    }>(
      `SELECT u.id, u.email, u.password_hash, u.is_active,
              e.id as employee_id, e.rocketchat_user_id, e.employment_status,
              r.key as role_key
       FROM users u
       LEFT JOIN employees e ON e.auth_user_id = u.id
       LEFT JOIN roles r ON r.id = e.role_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (res.rows.length === 0) return null;

    const first = res.rows[0];
    const roleKeys = res.rows.map((row) => row.role_key).filter(Boolean);

    return {
      id: first.id,
      email: first.email,
      password_hash: first.password_hash,
      is_active: first.is_active,
      employee_id: first.employee_id,
      rocketchat_user_id: first.rocketchat_user_id,
      employment_status: first.employment_status || 'active',
      role_keys: roleKeys.length > 0 ? roleKeys : ['employee'],
    };
  }

  async createUser(data: { email: string; passwordHash: string }): Promise<UserRow> {
    const res = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING *`,
      [data.email.toLowerCase().trim(), data.passwordHash]
    );
    return res.rows[0];
  }
}

export const userRepository = new UserRepository();
