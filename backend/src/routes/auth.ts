import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService, InvalidCredentialsError, AccountSuspendedError } from '../services/auth.service';

const router: Router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const input = loginSchema.parse(req.body);
    const authData = await authService.login(input);
    return res.status(200).json(authData);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (err instanceof AccountSuspendedError) {
      return res.status(403).json({ error: 'Account suspended' });
    }
    return res.status(500).json({ error: 'Internal server error', details: (err as Error).message });
  }
});

export default router;
