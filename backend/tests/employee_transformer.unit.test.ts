import { describe, it, expect } from 'vitest';
import { deriveTempPassword, resolveEmploymentStatus } from '../scripts/migrate-employees';

describe('Employee Transformer Unit Tests (W-701 Unit)', () => {
  describe('deriveTempPassword', () => {
    it('should return fixed password Hacking@159$', () => {
      const uuid = 'c62d08cb-5702-4543-8730-5a3874acb7b3';
      const result = deriveTempPassword(uuid);
      expect(result).toBe('Hacking@159$');
    });

    it('should return fixed password Hacking@159$ even if UUID is null or empty', () => {
      expect(deriveTempPassword(null)).toBe('Hacking@159$');
      expect(deriveTempPassword('')).toBe('Hacking@159$');
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
