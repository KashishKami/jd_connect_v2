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

  it('hashes new_password and updates user password_hash when new_password provided', async () => {
    const mockUserRepo = {
      updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'emp-uuid-1', auth_user_id: 'user-uuid-1' }),
      updateEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        full_name: 'Target Employee',
      }),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);
    await service.updateEmployee('emp-uuid-1', {
      new_password: 'UpdatedPassword123!',
    });

    expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith('user-uuid-1', expect.stringMatching(/^\$2[ayb]\$/));
  });
});
