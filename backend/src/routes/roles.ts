import { Router } from 'express';
import { authenticateJwt, requirePermission } from '../middleware/auth';
import { permissionsService, ImmutableRoleError, UnknownPermissionKeyError } from '../services/permissions.service';

export const rolesRouter: Router = Router();

// GET /api/roles - Returns all roles with their permission keys
rolesRouter.get('/roles', authenticateJwt, requirePermission('permissions.view'), async (_req, res, next) => {
  try {
    const roles = await permissionsService.getRolesWithPermissions();
    res.status(200).json(roles);
  } catch (err) {
    next(err);
  }
});

// GET /api/roles/:roleKey/permissions - Returns permission keys for specific role
rolesRouter.get('/roles/:roleKey/permissions', authenticateJwt, requirePermission('permissions.view'), async (req, res, next) => {
  try {
    const { roleKey } = req.params;
    const permissions = await permissionsService.getRolePermissions(roleKey);
    res.status(200).json({ roleKey, permissions });
  } catch (err) {
    next(err);
  }
});

// PUT /api/roles/:roleKey/permissions - Update permission assignment for role
rolesRouter.put('/roles/:roleKey/permissions', authenticateJwt, requirePermission('permissions.manage'), async (req, res, next) => {
  try {
    const { roleKey } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'permissions must be an array of strings' });
      return;
    }

    await permissionsService.updateRolePermissions(roleKey, permissions);
    res.status(200).json({ success: true, roleKey, permissions });
  } catch (err) {
    if (err instanceof ImmutableRoleError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof UnknownPermissionKeyError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});
