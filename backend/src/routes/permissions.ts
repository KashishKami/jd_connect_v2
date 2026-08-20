import { Router } from 'express';
import { authenticateJwt, requirePermission } from '../middleware/auth';
import { permissionsService } from '../services/permissions.service';

export const permissionsRouter: Router = Router();

// GET /api/me/permissions - Returns caller permissions array
permissionsRouter.get('/me/permissions', authenticateJwt, async (req, res, next) => {
  try {
    const roles = req.employee?.roles || [];
    const permissions = await permissionsService.getMyPermissions(roles);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ permissions });
  } catch (err) {
    next(err);
  }
});

// GET /api/permissions - Returns all permission taxonomy items
permissionsRouter.get('/permissions', authenticateJwt, requirePermission('permissions.view'), async (_req, res, next) => {
  try {
    const permissions = await permissionsService.getAllPermissions();
    res.status(200).json(permissions);
  } catch (err) {
    next(err);
  }
});
