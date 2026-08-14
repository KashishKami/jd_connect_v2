import { Router, Request, Response } from 'express';
import { breakService } from '../services/break.service';

const router: Router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const breakTypes = await breakService.getBreakTypes(true);
    return res.status(200).json(breakTypes);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
