import bcrypt from 'bcryptjs';
import { UserRepository, userRepository as defaultUserRepo } from '../repositories/user.repository';
import { EmployeeRepository, employeeRepository as defaultEmpRepo } from '../repositories/employee.repository';
import { ZulipService, zulipService as defaultZulipService } from './zulip.service';
import { CreateEmployeeInput, EmployeeResponse, EmployeeFilters, UpdateEmployeeInput } from '../types/employee';

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email already exists: ${email}`);
    this.name = 'DuplicateEmailError';
  }
}

export class EmployeeNotFoundError extends Error {
  constructor(id: string) {
    super(`Employee not found: ${id}`);
    this.name = 'EmployeeNotFoundError';
  }
}

export class InsufficientPermissionsError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}

export class EmployeeService {
  constructor(
    private userRepo: UserRepository = defaultUserRepo,
    private empRepo: EmployeeRepository = defaultEmpRepo,
    private zulipSvc: ZulipService = defaultZulipService
  ) {}

  async listEmployees(
    filters?: EmployeeFilters,
    callerPermissions?: string[]
  ): Promise<EmployeeResponse[]> {
    const effectiveFilters: EmployeeFilters = { ...filters };

    if (callerPermissions) {
      if (!callerPermissions.includes('employees.filter.by_role')) {
        delete effectiveFilters.role_key;
      }
      if (!callerPermissions.includes('employees.filter.by_department')) {
        delete effectiveFilters.department_id;
      }
      if (!callerPermissions.includes('employees.filter.by_status')) {
        delete effectiveFilters.status;
      }
    }

    const employees = await this.empRepo.findAllEmployees(effectiveFilters);

    if (callerPermissions && !callerPermissions.includes('employees.view.sensitive')) {
      return employees.map((emp) => {
        const copy = { ...emp };
        delete copy.mobile;
        delete copy.designation;
        delete copy.joining_date;
        return copy;
      });
    }

    return employees;
  }

  async updateEmployee(
    id: string,
    updates: UpdateEmployeeInput,
    callerPermissions?: string[]
  ): Promise<EmployeeResponse> {
    const employee = await this.empRepo.findById(id);
    if (!employee) {
      throw new EmployeeNotFoundError(id);
    }

    if (callerPermissions) {
      if ((updates.role_key || updates.role_id) && !callerPermissions.includes('employees.edit.role')) {
        throw new InsufficientPermissionsError('Missing employees.edit.role permission');
      }
      if (updates.employment_status && !callerPermissions.includes('employees.edit.status')) {
        throw new InsufficientPermissionsError('Missing employees.edit.status permission');
      }
    }

    const fieldUpdates: Record<string, unknown> = { ...updates };

    if (updates.role_key && !updates.role_id) {
      const roleRow = await this.empRepo.findRoleByKey(updates.role_key);
      if (roleRow) {
        fieldUpdates.role_id = roleRow.id;
      }
      delete fieldUpdates.role_key;
    }

    if (updates.new_password) {
      if (employee.auth_user_id) {
        const passwordHash = await bcrypt.hash(updates.new_password, 12);
        await this.userRepo.updatePasswordHash(employee.auth_user_id, passwordHash);
      }
      delete fieldUpdates.new_password;
    }

    return await this.empRepo.updateEmployee(id, fieldUpdates);
  }

  async createEmployee(
    input: CreateEmployeeInput
  ): Promise<EmployeeResponse & { warning?: string }> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new DuplicateEmailError(input.email);
    }

    let roleId = input.role_id;
    if (!roleId && input.role_key) {
      const roleRow = await this.empRepo.findRoleByKey(input.role_key);
      if (roleRow) {
        roleId = roleRow.id;
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.userRepo.createUser({
      email: input.email,
      passwordHash,
    });

    const emp = await this.empRepo.createEmployee(user.id, {
      ...input,
      role_id: roleId,
    });

    try {
      const zulipRes = await this.zulipSvc.createUser({
        email: input.email,
        full_name: input.alias || input.full_name,
        password: input.password,
      });

      const updatedEmp = await this.empRepo.updateZulipProvisioning(
        emp.id,
        zulipRes.zulipUserId,
        true
      );
      return updatedEmp;
    } catch {
      return {
        ...emp,
        zulip_provisioned: false,
        zulip_user_id: null,
        warning: 'Zulip account creation failed',
      };
    }
  }

  async retryZulipProvisioning(
    employeeId: string
  ): Promise<EmployeeResponse> {
    const employee = await this.empRepo.findById(employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(employeeId);
    }

    if (employee.zulip_provisioned && employee.zulip_user_id !== null) {
      return employee;
    }

    // Attempt creation with random/default temp password if unknown, or provision user
    const zulipRes = await this.zulipSvc.createUser({
      email: employee.email,
      full_name: employee.full_name,
      password: 'TempPassword123!',
    });

    return await this.empRepo.updateZulipProvisioning(
      employee.id,
      zulipRes.zulipUserId,
      true
    );
  }

  async resetPassword(employeeId: string, newPassword: string): Promise<void> {
    const employee = await this.empRepo.findById(employeeId);
    if (!employee || !employee.auth_user_id) {
      throw new EmployeeNotFoundError(employeeId);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.updatePasswordHash(employee.auth_user_id, passwordHash);
  }
}

export const employeeService = new EmployeeService();
