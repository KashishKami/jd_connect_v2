import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../src/services/auth.service';
import { UserRepository } from '../src/repositories/user.repository';
import { SessionRepository } from '../src/repositories/session.repository';
import bcrypt from 'bcryptjs';

describe('AuthService Unit Tests', () => {
  it('throws InvalidCredentialsError when user email is not found', async () => {
    const mockUserRepo = {
      findAuthUserByEmail: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepository;

    const mockSessionRepo = {
      createSession: vi.fn(),
    } as unknown as SessionRepository;

    const authService = new AuthService(mockUserRepo, mockSessionRepo);

    await expect(
      authService.login({ email: 'unknown@company.com', password: 'Password123!' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('throws InvalidCredentialsError when password comparison fails', async () => {
    const hash = await bcrypt.hash('RealPassword123!', 10);
    const mockUserRepo = {
      findAuthUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-uuid-1',
        email: 'agent@company.com',
        password_hash: hash,
        is_active: true,
        employee_id: 'emp-uuid-1',
        zulip_user_id: 1,
        employment_status: 'active',
        role_keys: ['employee'],
      }),
    } as unknown as UserRepository;

    const mockSessionRepo = {
      createSession: vi.fn(),
    } as unknown as SessionRepository;

    const authService = new AuthService(mockUserRepo, mockSessionRepo);

    await expect(
      authService.login({ email: 'agent@company.com', password: 'WrongPassword!' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('throws AccountSuspendedError when employment status is suspended', async () => {
    const hash = await bcrypt.hash('RealPassword123!', 10);
    const mockUserRepo = {
      findAuthUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-uuid-1',
        email: 'suspended@company.com',
        password_hash: hash,
        is_active: true,
        employee_id: 'emp-uuid-1',
        zulip_user_id: 1,
        employment_status: 'suspended',
        role_keys: ['employee'],
      }),
    } as unknown as UserRepository;

    const mockSessionRepo = {
      createSession: vi.fn(),
    } as unknown as SessionRepository;

    const authService = new AuthService(mockUserRepo, mockSessionRepo);

    await expect(
      authService.login({ email: 'suspended@company.com', password: 'RealPassword123!' })
    ).rejects.toThrow('Account suspended');
  });
});
