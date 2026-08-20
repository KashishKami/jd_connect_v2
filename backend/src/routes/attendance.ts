import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import {
  attendanceService,
  AlreadyClockedInError,
  NoOpenClockInError,
  ForbiddenError,
} from '../services/attendance.service';

const router: Router = Router();

router.get('/status', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const status = await attendanceService.getStatus(req.employee!.id);
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/monitor', authenticateJwt, async (_req: Request, res: Response) => {
  try {
    const summary = await attendanceService.getLiveMonitorSummary();
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/summary/today', authenticateJwt, async (_req: Request, res: Response) => {
  try {
    const summary = await attendanceService.getTodaySummary();
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
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
    };

    const records = await attendanceService.getAttendanceHistory(actor, filters);
    return res.status(200).json(records);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/clock-in', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const zulipUserId = req.employee?.zulip_user_id;
    if (!zulipUserId) {
      return res.status(400).json({ error: 'Employee chat profile not linked' });
    }

    const record = await attendanceService.clockIn(zulipUserId);
    return res.status(201).json(record);
  } catch (error) {
    if (error instanceof AlreadyClockedInError) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/clock-out', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const zulipUserId = req.employee?.zulip_user_id;
    if (!zulipUserId) {
      return res.status(400).json({ error: 'Employee chat profile not linked' });
    }

    const record = await attendanceService.clockOut(zulipUserId);
    return res.status(200).json(record);
  } catch (error) {
    if (error instanceof NoOpenClockInError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
