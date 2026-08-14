import { describe, it, expect } from 'vitest';
import { computeBreakDuration, computeBreakStatus } from '../src/services/break.service';

describe('computeBreakDuration & computeBreakStatus Unit Tests', () => {
  it('computes break duration in minutes accurately', () => {
    const startAt = new Date('2026-08-15T10:00:00Z');
    const endAt = new Date('2026-08-15T10:15:30Z'); // 15.5 minutes

    const duration = computeBreakDuration(startAt, endAt);
    expect(duration).toBe(15.5);
  });

  it('marks status completed when duration is within limit', () => {
    expect(computeBreakStatus(14.5, 15)).toBe('completed');
    expect(computeBreakStatus(15.0, 15)).toBe('completed');
  });

  it('marks status exceeded when duration exceeds limit', () => {
    expect(computeBreakStatus(15.1, 15)).toBe('exceeded');
  });

  it('marks status completed when limit_minutes is null (unlimited break)', () => {
    expect(computeBreakStatus(120, null)).toBe('completed');
  });
});
