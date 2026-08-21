import { describe, it, expect } from 'vitest';
import { hasPermission, isSessionActive } from '../src/lib/auth';

describe('HR Dashboard Auth & Permissions Tests (W-601 Integration)', () => {
  it('returns true when user has required permission key', () => {
    const userPermissions = ['employees.manage', 'hr.reset_password', 'attendance.view_all'];
    expect(hasPermission(userPermissions, 'hr.reset_password')).toBe(true);
  });

  it('returns false when user lacks required permission key', () => {
    const userPermissions = ['employees.view', 'attendance.view_own'];
    expect(hasPermission(userPermissions, 'hr.reset_password')).toBe(false);
  });

  it('verifies active session based on non-empty token string', () => {
    expect(isSessionActive('valid_jwt_string')).toBe(true);
    expect(isSessionActive(null)).toBe(false);
    expect(isSessionActive('')).toBe(false);
  });
});
