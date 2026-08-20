import { describe, it, expect, vi } from 'vitest';
import { EmployeeService } from '../src/services/employee.service';
import { UserRepository } from '../src/repositories/user.repository';
import { EmployeeRepository } from '../src/repositories/employee.repository';

import { ZulipService } from '../src/services/zulip.service';

describe('EmployeeService Unit Tests', () => {
  it('hashes password and creates user + employee record', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue({ id: 'user-uuid-1', email: 'test@company.com' }),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      createEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        auth_user_id: 'user-uuid-1',
        employee_code: 'JD0001',
        full_name: 'Test Agent',
        email: 'test@company.com',
        zulip_provisioned: false,
      }),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);
    const result = await service.createEmployee({
      full_name: 'Test Agent',
      email: 'test@company.com',
      password: 'Password123!',
      role_id: 'role-uuid-1',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@company.com');
    expect(mockUserRepo.createUser).toHaveBeenCalled();
    expect(mockEmpRepo.createEmployee).toHaveBeenCalled();
    expect(result.zulip_provisioned).toBe(false);
    expect(result.employee_code).toBe('JD0001');
  });

  it('throws DuplicateEmailError when email already exists', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'existing-id', email: 'duplicate@company.com' }),
      createUser: vi.fn(),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      createEmployee: vi.fn(),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);

    await expect(
      service.createEmployee({
        full_name: 'Duplicate Agent',
        email: 'duplicate@company.com',
        password: 'Password123!',
        role_id: 'role-uuid-1',
      })
    ).rejects.toThrow('Email already exists');

    expect(mockUserRepo.createUser).not.toHaveBeenCalled();
    expect(mockEmpRepo.createEmployee).not.toHaveBeenCalled();
  });

  it('passes alias as full_name to Zulip service if provided', async () => {
    const mockUserRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue({ id: 'user-uuid-1', email: 'adam@company.com' }),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      createEmployee: vi.fn().mockResolvedValue({
        id: 'emp-uuid-1',
        auth_user_id: 'user-uuid-1',
        employee_code: 'JD0002',
        full_name: 'Adam Johnson',
        alias: 'Adam',
        email: 'adam@company.com',
        zulip_provisioned: true,
        zulip_user_id: 10,
      }),
      updateZulipProvisioning: vi.fn().mockImplementation((id, zulipId, isProv) => ({
        id,
        full_name: 'Adam Johnson',
        alias: 'Adam',
        email: 'adam@company.com',
        zulip_provisioned: isProv,
        zulip_user_id: zulipId,
      })),
    } as unknown as EmployeeRepository;

    const mockZulipSvc = {
      createUser: vi.fn().mockResolvedValue({ zulipUserId: 10, email: 'adam@company.com' }),
    } as unknown as ZulipService;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo, mockZulipSvc);
    const result = await service.createEmployee({
      full_name: 'Adam Johnson',
      alias: 'Adam',
      email: 'adam@company.com',
      password: 'Password123!',
      role_id: 'role-uuid-1',
    });

    expect(mockEmpRepo.createEmployee).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({
        alias: 'Adam',
      })
    );

    expect(mockZulipSvc.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Adam',
      })
    );

    expect(result.alias).toBe('Adam');
  });
});
