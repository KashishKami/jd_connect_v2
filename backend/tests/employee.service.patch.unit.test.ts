import { describe, it, expect, vi } from 'vitest';
import { EmployeeService } from '../src/services/employee.service';
import { UserRepository } from '../src/repositories/user.repository';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('EmployeeService PATCH Unit Tests', () => {
  it('calls repository updateEmployee with provided fields', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn(),
      updatePasswordHash: vi.fn(),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'emp-uuid-1', auth_user_id: 'user-uuid-1' }),
      updateEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        full_name: 'Target Employee',
        alias: 'NewAlias',
      }),
      findRoleByKey: vi.fn().mockResolvedValue({ id: 'role-mgr-1' }),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);
    const result = await service.updateEmployee('emp-uuid-1', {
      alias: 'NewAlias',
      role_key: 'manager',
    });

    expect(mockEmpRepo.findRoleByKey).toHaveBeenCalledWith('manager');
    expect(mockEmpRepo.updateEmployee).toHaveBeenCalledWith('emp-uuid-1', expect.objectContaining({
      alias: 'NewAlias',
      role_id: 'role-mgr-1',
    }));
    expect(result.alias).toBe('NewAlias');
  });

  it('hashes new_password, updates user password_hash, and updates Zulip password when new_password provided', async () => {
    const mockUserRepo = {
      updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        auth_user_id: 'user-uuid-1',
        email: 'target@jdconnect.com',
        zulip_user_id: 101,
      }),
      updateEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        full_name: 'Target Employee',
      }),
    } as unknown as EmployeeRepository;

    const mockZulipSvc = {
      updateUserPassword: vi.fn().mockResolvedValue(true),
    } as unknown as import('../src/services/zulip.service').ZulipService;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo, mockZulipSvc);
    await service.updateEmployee('emp-uuid-1', {
      new_password: 'UpdatedPassword123!',
    });

    expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith('user-uuid-1', expect.stringMatching(/^\$2[ayb]\$/));
    expect(mockZulipSvc.updateUserPassword).toHaveBeenCalledWith('target@jdconnect.com', 'UpdatedPassword123!', 101);
  });

  it('updates email in users and employees tables and syncs to Zulip when valid email provided', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      updateEmail: vi.fn().mockResolvedValue(true),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        auth_user_id: 'user-uuid-1',
        email: 'old.email@jdconnect.com',
        zulip_user_id: 101,
      }),
      updateEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        email: 'new.email@jdconnect.com',
        full_name: 'Target Employee',
      }),
    } as unknown as EmployeeRepository;

    const mockZulipSvc = {
      updateUserEmail: vi.fn().mockResolvedValue(true),
    } as unknown as import('../src/services/zulip.service').ZulipService;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo, mockZulipSvc);
    const result = await service.updateEmployee('emp-uuid-1', {
      email: '  New.Email@JDCONNECT.com  ',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('new.email@jdconnect.com');
    expect(mockUserRepo.updateEmail).toHaveBeenCalledWith('user-uuid-1', 'new.email@jdconnect.com');
    expect(mockEmpRepo.updateEmployee).toHaveBeenCalledWith('emp-uuid-1', expect.objectContaining({
      email: 'new.email@jdconnect.com',
    }));
    expect(mockZulipSvc.updateUserEmail).toHaveBeenCalledWith('old.email@jdconnect.com', 'new.email@jdconnect.com', 101);
    expect(result.email).toBe('new.email@jdconnect.com');
  });

  it('throws DuplicateEmailError when new email is already used by another user', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'other-user-uuid', email: 'taken@jdconnect.com' }),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        auth_user_id: 'user-uuid-1',
        email: 'current@jdconnect.com',
      }),
      updateEmployee: vi.fn(),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);

    await expect(
      service.updateEmployee('emp-uuid-1', {
        email: 'taken@jdconnect.com',
      })
    ).rejects.toThrow('Email already exists: taken@jdconnect.com');

    expect(mockEmpRepo.updateEmployee).not.toHaveBeenCalled();
  });

  it('allows updating if email matches the current user email (same email no-op/case change)', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'user-uuid-1', email: 'current@jdconnect.com' }),
      updateEmail: vi.fn().mockResolvedValue(true),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        auth_user_id: 'user-uuid-1',
        email: 'current@jdconnect.com',
        zulip_user_id: 101,
      }),
      updateEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        email: 'current@jdconnect.com',
        full_name: 'Target Employee',
      }),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);
    const result = await service.updateEmployee('emp-uuid-1', {
      email: 'current@jdconnect.com',
    });

    expect(mockEmpRepo.updateEmployee).toHaveBeenCalled();
    expect(result.email).toBe('current@jdconnect.com');
  });
});
