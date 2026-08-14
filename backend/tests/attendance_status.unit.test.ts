import { describe, it, expect } from 'vitest';
import { computeAttendanceStatus } from '../src/services/attendance.service';

describe('computeAttendanceStatus - Business Logic Unit Tests', () => {
  const shiftStart = new Date('2026-08-15T09:00:00-05:00'); // 09:00 AM EST shift start

  it('classifies as present and not late when clocked in by 09:15 AM EST and hours >= 6', () => {
    const clockInAt = new Date('2026-08-15T09:10:00-05:00'); // 09:10 AM EST (within 15 min buffer)
    const result = computeAttendanceStatus(clockInAt, shiftStart, 8);
    expect(result).toEqual({ status: 'present', isLate: false });
  });

  it('classifies as late and is_late true when clocked in between 09:15 and 09:30 AM EST and hours >= 6', () => {
    const clockInAt = new Date('2026-08-15T09:20:00-05:00'); // 09:20 AM EST
    const result = computeAttendanceStatus(clockInAt, shiftStart, 8);
    expect(result).toEqual({ status: 'late', isLate: true });
  });

  it('classifies as half_day when clocked in after 09:30 AM EST even if hours >= 6', () => {
    const clockInAt = new Date('2026-08-15T09:35:00-05:00'); // 09:35 AM EST
    const result = computeAttendanceStatus(clockInAt, shiftStart, 8);
    expect(result).toEqual({ status: 'half_day', isLate: false });
  });

  it('classifies as half_day when hours < 6 even if clocked in before 09:15 AM EST (priority rule)', () => {
    const clockInAt = new Date('2026-08-15T09:00:00-05:00'); // 09:00 AM EST (perfect)
    const result = computeAttendanceStatus(clockInAt, shiftStart, 4.5); // only 4.5 hours
    expect(result).toEqual({ status: 'half_day', isLate: false });
  });
});
