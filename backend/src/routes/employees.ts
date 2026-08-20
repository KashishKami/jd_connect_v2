import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJwt, requirePermission } from '../middleware/auth';
import { employeeService, DuplicateEmailError, EmployeeNotFoundError } from '../services/employee.service';

const router: Router = Router();

const createEmployeeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  alias: z.string().optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role_id: z.string().uuid('Invalid role_id UUID').optional(),
  role_key: z.string().optional(),
  mobile: z.string().optional(),
  department_id: z.string().uuid().optional(),
  centre_id: z.string().uuid().optional(),
  shift_id: z.string().uuid().optional(),
  team_leader_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional(),
  designation: z.string().optional(),
}).refine(data => data.role_id || data.role_key, {
  message: 'Either role_id or role_key is required',
});

const resetPasswordSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

const updateEmployeeSchema = z.object({
  full_name: z.string().min(1).optional(),
  alias: z.string().optional(),
  designation: z.string().optional(),
  department_id: z.string().uuid().nullable().optional(),
  role_key: z.string().optional(),
  role_id: z.string().uuid().optional(),
  mobile: z.string().optional(),
  employment_status: z.enum(['active', 'suspended', 'resigned', 'terminated', 'absconded']).optional(),
  shift_id: z.string().uuid().nullable().optional(),
  centre_id: z.string().uuid().nullable().optional(),
  new_password: z.string().min(8, 'Password must be at least 8 characters').optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required for update',
});

router.get(
  '/',
  authenticateJwt,
  requirePermission('employees.view'),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        department_id: typeof req.query.department_id === 'string' ? req.query.department_id : undefined,
        role_key: typeof req.query.role_key === 'string' ? req.query.role_key : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      };
      const employees = await employeeService.listEmployees(filters);
      return res.status(200).json(employees);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to list employees', details: (err as Error).message });
    }
  }
);

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

router.patch(
  '/:id',
  authenticateJwt,
  requirePermission('employees.manage'),
  async (req: Request, res: Response) => {
    try {
      const input = updateEmployeeSchema.parse(req.body);
      const employee = await employeeService.updateEmployee(req.params.id, input);
      return res.status(200).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
      }
      if (err instanceof EmployeeNotFoundError) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      return res.status(500).json({ error: 'Failed to update employee', details: (err as Error).message });
    }
  }
);

router.post(
  '/:id/retry-zulip-provisioning',
  authenticateJwt,
  requirePermission('employees.manage'),
  async (req: Request, res: Response) => {
    try {
      const employee = await employeeService.retryZulipProvisioning(req.params.id);
      return res.status(200).json(employee);
    } catch (err) {
      if (err instanceof EmployeeNotFoundError) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      return res.status(500).json({ error: 'Failed to retry Zulip provisioning', details: (err as Error).message });
    }
  }
);

router.post(
  '/:id/reset-password',
  authenticateJwt,
  requirePermission('hr.reset_password'),
  async (req: Request, res: Response) => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      await employeeService.resetPassword(req.params.id, input.new_password);
      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
      }
      if (err instanceof EmployeeNotFoundError) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      return res.status(500).json({ error: 'Failed to reset password', details: (err as Error).message });
    }
  }
);

export default router;
