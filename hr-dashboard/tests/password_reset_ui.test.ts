import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAdminPasswordReset } from '../src/components/password_validator';

describe('Password Reset UI Integration Tests (W-604)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Backend API POST /api/employees/:id/reset-password with new password payload', async () => {
    const mockPost = vi.fn().mockResolvedValue({ message: 'Password updated successfully' });
    const mockApi = { post: mockPost };

    const res = await executeAdminPasswordReset(mockApi, 'emp-10', 'NewSecret123!');
    expect(mockPost).toHaveBeenCalledWith('/api/employees/emp-10/reset-password', {
      new_password: 'NewSecret123!',
    });
    expect(res).toEqual({ message: 'Password updated successfully' });
  });
});
