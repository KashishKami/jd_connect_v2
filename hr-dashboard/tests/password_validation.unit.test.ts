import { describe, it, expect } from 'vitest';
import { validateResetPasswordInput } from '../src/components/password_validator';

describe('Password Reset Validation Unit Tests (W-604)', () => {
  it('returns valid true when password is at least 8 chars and matches confirmation', () => {
    const res = validateResetPasswordInput('NewSecret123!', 'NewSecret123!');
    expect(res).toEqual({ valid: true, error: null });
  });

  it('returns error when password is under 8 characters', () => {
    const res = validateResetPasswordInput('short', 'short');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Password must be at least 8 characters');
  });

  it('returns error when passwords do not match', () => {
    const res = validateResetPasswordInput('NewSecret123!', 'DifferentPass123!');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Passwords do not match');
  });
});
