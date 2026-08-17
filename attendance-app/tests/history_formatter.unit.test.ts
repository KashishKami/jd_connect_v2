import { describe, it, expect } from 'vitest';
import {
  formatHistoryDate,
  formatDuration,
  formatStatusBadge,
  formatAttendanceStatus,
  formatBreakReason,
} from '../src/lib/history_formatter';

describe('Attendance & Break History Formatter Utilities', () => {
  it('formats ISO timestamps into human-readable time strings', () => {
    const isoString = '2026-08-17T09:00:00.000Z';
    const formatted = formatHistoryDate(isoString);
    expect(formatted).not.toBe('-');
    expect(typeof formatted).toBe('string');
  });

  it('returns dash for null or undefined timestamps', () => {
    expect(formatHistoryDate(null)).toBe('-');
    expect(formatHistoryDate(undefined)).toBe('-');
  });

  it('formats duration minutes cleanly', () => {
    expect(formatDuration(15)).toBe('15 mins');
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(0)).toBe('0 mins');
  });

  it('returns clean status badge labels', () => {
    expect(formatStatusBadge('present')).toBe('Present');
    expect(formatStatusBadge('completed')).toBe('Completed');
    expect(formatStatusBadge('exceeded')).toBe('Exceeded');
  });

  it('formats status as On Shift when shift is still open (clock_out_at is null)', () => {
    const openRecord = {
      clock_in_at: '2026-08-17T09:00:00.000Z',
      clock_out_at: null,
      status: 'absent',
    };
    const result = formatAttendanceStatus(openRecord);
    expect(result.label).toBe('On Shift');
    expect(result.cssClass).toBe('on-shift');
  });

  it('formats status as Present/Late when shift is closed (clock_out_at is present)', () => {
    const closedRecord = {
      clock_in_at: '2026-08-17T09:00:00.000Z',
      clock_out_at: '2026-08-17T18:00:00.000Z',
      status: 'present',
    };
    const result = formatAttendanceStatus(closedRecord);
    expect(result.label).toBe('Present');
    expect(result.cssClass).toBe('present');
  });

  it('formats break reason correctly from break_name or break_type_key', () => {
    expect(formatBreakReason({ break_name: 'Bio Break' })).toBe('Bio Break');
    expect(formatBreakReason({ break_type_key: 'tea' })).toBe('tea');
    expect(formatBreakReason({})).toBe('Break');
  });
});
