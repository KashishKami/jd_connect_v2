import { describe, it, expect } from 'vitest';
import { formatOriginalTime } from '../scripts/migrate-chat';

describe('Chat Time Formatter Unit Tests (W-703 Unit)', () => {
  it('should format UTC timestamp correctly to EST (America/New_York)', () => {
    // 2026-06-13 23:59:00 UTC is 2026-06-13 19:59:00 EDT (UTC-4)
    const date = new Date('2026-06-13T23:59:00Z');
    const result = formatOriginalTime(date);
    expect(result).toBe('13 Jun 2026, 7:59pm');
  });

  it('should format winter timestamp correctly to EST (America/New_York)', () => {
    // 2026-12-15 12:00:00 UTC is 2026-12-15 07:00:00 EST (UTC-5)
    const date = new Date('2026-12-15T12:00:00Z');
    const result = formatOriginalTime(date);
    expect(result).toBe('15 Dec 2026, 7:00am');
  });
});
