import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import pool from '../lib/db';

const router: Router = Router();

router.get('/', authenticateJwt, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, name, start_time, end_time FROM shifts ORDER BY name ASC');
    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list shifts', details: (err as Error).message });
  }
});

export default router;
