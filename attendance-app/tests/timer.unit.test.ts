import { describe, it, expect } from 'vitest';
import { formatDuration } from '../src/timer';

describe('Timer Unit Tests (W-502)', () => {
  it('formats zero seconds correctly as 00:00:00', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formats elapsed seconds into HH:MM:SS format', () => {
    expect(formatDuration(3665)).toBe('01:01:05');
  });

  it('formats 8 hours shift duration correctly', () => {
    expect(formatDuration(28800)).toBe('08:00:00');
  });
});
