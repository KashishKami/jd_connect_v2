import { describe, it, expect } from 'vitest';
import { resolveBreakStatus, resolveAttendanceSource } from '../scripts/migrate-attendance';

describe('Attendance Transformer Unit Tests (W-702 Unit)', () => {
  describe('resolveBreakStatus', () => {
    it('should map valid break statuses directly', () => {
      expect(resolveBreakStatus('active')).toBe('active');
      expect(resolveBreakStatus('completed')).toBe('completed');
      expect(resolveBreakStatus('exceeded')).toBe('exceeded');
    });

    it('should fall back to completed if null or invalid', () => {
      expect(resolveBreakStatus('invalid_status')).toBe('completed');
      expect(resolveBreakStatus(null)).toBe('completed');
    });
  });

  describe('resolveAttendanceSource', () => {
    it('should map valid attendance sources directly', () => {
      expect(resolveAttendanceSource('auto')).toBe('auto');
      expect(resolveAttendanceSource('manual')).toBe('manual');
      expect(resolveAttendanceSource('correction')).toBe('correction');
    });

    it('should fall back to auto if null or invalid', () => {
      expect(resolveAttendanceSource('invalid_source')).toBe('auto');
      expect(resolveAttendanceSource(null)).toBe('auto');
    });
  });
});
