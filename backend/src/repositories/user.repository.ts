import pool from '../lib/db';

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
