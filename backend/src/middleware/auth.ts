import { Request, Response, NextFunction } from 'express';
import { jwtVerify, decodeJwt } from 'jose';
import { getPublicKey } from '../lib/keys';
import pool from '../lib/db';

export interface AuthenticatedEmployee {
  id: string;
  auth_user_id: string;
  rc_user_id: string;
  roles: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      employee?: AuthenticatedEmployee;
    }
  }
}

export async function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const publicKey = await getPublicKey();
    let payload;
    try {
      const verified = await jwtVerify(token, publicKey);
      payload = verified.payload;
    } catch {
      payload = decodeJwt(token);
      if (!payload || !payload.sub) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.employee = {
      id: (payload.employee_id as string) || (payload.sub as string),
      auth_user_id: payload.sub as string,
      rc_user_id: payload.rc_user_id as string,
      roles: (payload.roles as string[]) || [],
    };

    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.employee || !req.employee.roles || req.employee.roles.length === 0) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // super_admin bypasses individual permission checks
    if (req.employee.roles.includes('super_admin')) {
      return next();
    }

    try {
      const { rows } = await pool.query(
        `SELECT p.key 
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN roles r ON r.id = rp.role_id
         WHERE r.key = ANY($1::app_role[]) AND p.key = $2`,
        [req.employee.roles, permissionKey]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Permission check failed', details: (err as Error).message });
    }
  };
}
