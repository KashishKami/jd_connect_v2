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

  describe('W-1004 Filter-ignoring, Field-stripping, and Role Update Checks', () => {
    it('ignores role_key filter if caller lacks employees.filter.by_role', async () => {
      const mockEmpRepo = {
        findAllEmployees: vi.fn().mockResolvedValue([]),
      } as unknown as EmployeeRepository;

      const service = new EmployeeService(undefined, mockEmpRepo);
      await service.listEmployees({ role_key: 'admin', search: 'john' }, ['employees.view']);

      expect(mockEmpRepo.findAllEmployees).toHaveBeenCalledWith({ search: 'john' });
    });

    it('strips sensitive fields (mobile, designation, joining_date) if caller lacks employees.view.sensitive', async () => {
      const mockEmp = {
        id: 'emp-1',
        full_name: 'Jane Doe',
        email: 'jane@jdconnect.com',
        mobile: '1234567890',
        designation: 'Lead Agent',
        joining_date: '2026-01-01',
      };
      const mockEmpRepo = {
        findAllEmployees: vi.fn().mockResolvedValue([mockEmp]),
      } as unknown as EmployeeRepository;

      const service = new EmployeeService(undefined, mockEmpRepo);
      const result = await service.listEmployees({}, ['employees.view']);

      expect(result[0]).toHaveProperty('full_name', 'Jane Doe');
      expect(result[0].mobile).toBeUndefined();
      expect(result[0].designation).toBeUndefined();
      expect(result[0].joining_date).toBeUndefined();
    });

    it('retains sensitive fields if caller has employees.view.sensitive', async () => {
      const mockEmp = {
        id: 'emp-1',
        full_name: 'Jane Doe',
        email: 'jane@jdconnect.com',
        mobile: '1234567890',
        designation: 'Lead Agent',
        joining_date: '2026-01-01',
      };
      const mockEmpRepo = {
        findAllEmployees: vi.fn().mockResolvedValue([mockEmp]),
      } as unknown as EmployeeRepository;

      const service = new EmployeeService(undefined, mockEmpRepo);
      const result = await service.listEmployees({}, ['employees.view', 'employees.view.sensitive']);

      expect(result[0].mobile).toBe('1234567890');
      expect(result[0].designation).toBe('Lead Agent');
    });

    it('throws InsufficientPermissionsError when updating role_key without employees.edit.role', async () => {
      const mockEmpRepo = {
        findById: vi.fn().mockResolvedValue({ id: 'emp-1', email: 'emp@test.com' }),
        updateEmployee: vi.fn(),
      } as unknown as EmployeeRepository;

      const service = new EmployeeService(undefined, mockEmpRepo);

      await expect(
        service.updateEmployee('emp-1', { role_key: 'admin' }, ['employees.edit'])
      ).rejects.toThrow('Missing employees.edit.role permission');

      expect(mockEmpRepo.updateEmployee).not.toHaveBeenCalled();
    });
  });
});
