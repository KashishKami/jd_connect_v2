import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { departmentRepository } from '../repositories/department.repository';

const router: Router = Router();

router.get('/', authenticateJwt, async (_req: Request, res: Response) => {
  try {
    const departments = await departmentRepository.listDepartments();
    return res.status(200).json(departments);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list departments', details: (err as Error).message });
  }
});

export default router;
