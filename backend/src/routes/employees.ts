import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJwt, requirePermission } from '../middleware/auth';
import { employeeService, DuplicateEmailError } from '../services/employee.service';

const router: Router = Router();

const createEmployeeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role_id: z.string().uuid('Invalid role_id UUID'),
  mobile: z.string().optional(),
  department_id: z.string().uuid().optional(),
  centre_id: z.string().uuid().optional(),
  shift_id: z.string().uuid().optional(),
  team_leader_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional(),
  designation: z.string().optional(),
});

router.post(
  '/',
  authenticateJwt,
  requirePermission('employees.manage'),
  async (req: Request, res: Response) => {
    try {
      const input = createEmployeeSchema.parse(req.body);
      const employee = await employeeService.createEmployee(input);
      return res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
      }
      if (err instanceof DuplicateEmailError) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: 'Failed to create employee', details: (err as Error).message });
    }
  }
);

export default router;
