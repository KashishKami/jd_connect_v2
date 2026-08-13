import pool from '../lib/db';

export interface SessionRow {
  id: string;
  user_id: string;
  session_token: string;
  is_active: boolean;
  created_at: Date;
  last_seen_at: Date;
}

export class SessionRepository {
  async createSession(userId: string, sessionTokenHash: string): Promise<SessionRow> {
    const res = await pool.query<SessionRow>(
      `INSERT INTO employee_sessions (user_id, session_token, is_active)
       VALUES ($1, $2, true)
       RETURNING *`,
      [userId, sessionTokenHash]
    );
    return res.rows[0];
  }

  async deactivateUserSessions(userId: string): Promise<void> {
    await pool.query(
      `UPDATE employee_sessions SET is_active = false WHERE user_id = $1`,
      [userId]
    );
  }
}

export const sessionRepository = new SessionRepository();
