import { describe, it, expect } from 'vitest';
import { isBreakOverrun } from '../src/timer';

describe('Break Overrun Unit Tests (W-503)', () => {
  it('returns false when break limit is null (unlimited break)', () => {
    expect(isBreakOverrun(45, null)).toBe(false);
  });

  it('returns false when duration is within limit', () => {
    expect(isBreakOverrun(10, 15)).toBe(false);
  });

  it('returns true when duration exceeds effective limit', () => {
    expect(isBreakOverrun(16, 15)).toBe(true);
  });
});
