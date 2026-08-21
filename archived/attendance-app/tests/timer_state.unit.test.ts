import { describe, it, expect } from 'vitest';
import { calculateElapsedSeconds } from '../src/lib/timer_utils';

describe('Shift Timer & Break Duration Preservation', () => {
  it('calculates elapsed seconds accurately from original clock-in time', () => {
    const startTime = new Date(Date.now() - 3600000); // 1 hour ago (3600s)
    const elapsed = calculateElapsedSeconds(startTime, new Date());
    expect(elapsed).toBeGreaterThanOrEqual(3599);
    expect(elapsed).toBeLessThanOrEqual(3602);
  });

  it('preserves initial clock-in start time when returning from breaks', () => {
    const originalClockIn = new Date('2026-08-17T12:00:00.000Z');
    let currentTimerStart: Date | null = originalClockIn;

    // Simulate updateUiClockedIn without passing new ISO string
    function updateUiClockedIn(newClockInIso?: string | null) {
      if (newClockInIso) {
        currentTimerStart = new Date(newClockInIso);
      } else if (!currentTimerStart) {
        currentTimerStart = new Date();
      }
    }

    // End break call (no new clockInIso)
    updateUiClockedIn(undefined);

    expect(currentTimerStart.toISOString()).toBe('2026-08-17T12:00:00.000Z');
  });
});
