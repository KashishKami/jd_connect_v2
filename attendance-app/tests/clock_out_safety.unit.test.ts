import { describe, it, expect } from 'vitest';
import { shouldPromptClockOutConfirmation } from '../src/lib/clock_out_safety';

describe('Clock Out Safety & Confirmation Utility', () => {
  it('requires user confirmation before executing clock-out', () => {
    expect(shouldPromptClockOutConfirmation('clocked_in')).toBe(true);
    expect(shouldPromptClockOutConfirmation('on_break')).toBe(true);
    expect(shouldPromptClockOutConfirmation('off_shift')).toBe(false);
  });
});
