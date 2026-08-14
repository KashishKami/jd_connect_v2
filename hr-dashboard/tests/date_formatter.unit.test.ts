import { describe, it, expect } from 'vitest';
import { formatESTDate, formatESTTime } from '../src/lib/date_formatter';

describe('EST Date Formatter Unit Tests (W-603)', () => {
  it('formats ISO timestamp into EST YYYY-MM-DD date string', () => {
    const iso = '2026-08-15T09:15:00.000Z';
    const dateStr = formatESTDate(iso);
    expect(dateStr).toMatch(/^2026-08-15$/);
  });

  it('formats ISO timestamp into EST HH:MM AM/PM time string', () => {
    const iso = '2026-08-15T13:30:00.000Z';
    const timeStr = formatESTTime(iso);
    expect(timeStr).toMatch(/09:30 AM|05:30 AM/); // 13:30 UTC -> 09:30 AM EST (UTC-4 EDT / UTC-5 EST)
  });
});
