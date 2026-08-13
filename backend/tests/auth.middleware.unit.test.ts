import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateJwt, requirePermission } from '../src/middleware/auth';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';

describe('Auth Middleware Unit & Scoping Tests', () => {
  let privateKey: KeyLike;
  let validToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    await runMigrations();
    await runSeed();

    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;

    validToken = await new SignJWT({
      sub: 'user-uuid-100',
      employee_id: 'emp-uuid-100',
      rc_user_id: 'RC_100',
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    expiredToken = await new SignJWT({
      sub: 'user-uuid-100',
      employee_id: 'emp-uuid-100',
      rc_user_id: 'RC_100',
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(privateKey);
  });

  function mockReqRes(headers: Record<string, string> = {}) {
    const req = {
      headers,
      employee: undefined,
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  }

  it('returns 401 when Authorization header is missing', async () => {
    const { req, res, next } = mockReqRes({});
    await authenticateJwt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT token is malformed', async () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer malformed.jwt.token' });
    await authenticateJwt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT token is expired', async () => {
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${expiredToken}` });
    await authenticateJwt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('populates req.employee and calls next() on valid Bearer JWT', async () => {
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${validToken}` });
    await authenticateJwt(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.employee).toBeDefined();
    expect(req.employee?.id).toBe('emp-uuid-100');
    expect(req.employee?.rc_user_id).toBe('RC_100');
    expect(req.employee?.roles).toEqual(['employee']);
  });

  it('requirePermission allows super_admin role unconditionally', async () => {
    const { req, res, next } = mockReqRes();
    req.employee = {
      id: 'admin-emp-id',
      auth_user_id: 'admin-user-id',
      rc_user_id: 'RC_admin',
      roles: ['super_admin'],
    };

    const middleware = requirePermission('hr.manage_roles');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requirePermission blocks user lacking requested permission with 403', async () => {
    const { req, res, next } = mockReqRes();
    req.employee = {
      id: 'emp-id',
      auth_user_id: 'user-id',
      rc_user_id: 'RC_emp',
      roles: ['employee'],
    };

    const middleware = requirePermission('hr.reset_password');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });
});
