import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import {
  breakService,
  NotClockedInError,
  AlreadyOnBreakError,
  InvalidBreakTypeError,
  NoActiveBreakError,
  ForbiddenError,
} from '../services/break.service';
import { BreakStatus } from '../types/break';

const router: Router = Router();

const startBreakSchema = z.object({
  break_type_key: z.string().min(1, 'break_type_key is required'),
});

router.get('/', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const actor = {
      id: req.employee!.id,
      roles: req.employee!.roles,
    };

    const filters = {
      employee_id: req.query.employee_id as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      status: req.query.status as BreakStatus | undefined,
      search: req.query.search as string | undefined,
    };

    const records = await breakService.getBreakHistory(actor, filters);
    return res.status(200).json(records);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/start', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const parseResult = startBreakSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.errors });
    }

    const zulipUserId = req.employee?.zulip_user_id;
    if (!zulipUserId) {
      return res.status(400).json({ error: 'Employee chat profile not linked' });
    }

    const breakRecord = await breakService.startBreak(zulipUserId, parseResult.data.break_type_key);
    return res.status(201).json(breakRecord);
  } catch (error) {
    if (error instanceof NotClockedInError || error instanceof InvalidBreakTypeError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof AlreadyOnBreakError) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/end', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const zulipUserId = req.employee?.zulip_user_id;
    if (!zulipUserId) {
      return res.status(400).json({ error: 'Employee chat profile not linked' });
    }

    const breakRecord = await breakService.endBreak(zulipUserId);
    return res.status(200).json(breakRecord);
  } catch (error) {
    if (error instanceof NoActiveBreakError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
