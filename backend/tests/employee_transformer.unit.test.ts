import { describe, it, expect } from 'vitest';
import { deriveTempPassword, resolveEmploymentStatus } from '../scripts/migrate-employees';

describe('Employee Transformer Unit Tests (W-701 Unit)', () => {
  describe('deriveTempPassword', () => {
    it('should derive temp password using last 4 characters of UUID', () => {
      const uuid = 'c62d08cb-5702-4543-8730-5a3874acb7b3';
      const result = deriveTempPassword(uuid);
      expect(result).toBe('TempPass@b7b3!'); // last 4: b7b3
    });

    it('should fall back to auth_user if UUID is null or empty', () => {
      const result = val => deriveTempPassword(val);
      expect(result(null)).toBe('TempPass@user!'); // last 4 of 'auth_user' is 'user'
      expect(result('')).toBe('TempPass@user!');
    });
  });

  describe('resolveEmploymentStatus', () => {
    it('should pass through valid statuses', () => {
      expect(resolveEmploymentStatus('active')).toBe('active');
      expect(resolveEmploymentStatus('suspended')).toBe('suspended');
      expect(resolveEmploymentStatus('terminated')).toBe('terminated');
    });

    it('should fall back to active for invalid statuses', () => {
      expect(resolveEmploymentStatus('unknown_status')).toBe('active');
      expect(resolveEmploymentStatus(null)).toBe('active');
    });
  });
});
