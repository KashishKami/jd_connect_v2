import bcrypt from 'bcryptjs';
import { UserRepository, userRepository as defaultUserRepo } from '../repositories/user.repository';
import { EmployeeRepository, employeeRepository as defaultEmpRepo } from '../repositories/employee.repository';
import { CreateEmployeeInput, EmployeeResponse } from '../types/employee';

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

export class EmployeeService {
  constructor(
    private userRepo: UserRepository = defaultUserRepo,
    private empRepo: EmployeeRepository = defaultEmpRepo
  ) {}

  async createEmployee(input: CreateEmployeeInput): Promise<EmployeeResponse> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new DuplicateEmailError(input.email);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.userRepo.createUser({
      email: input.email,
      passwordHash,
    });

    return await this.empRepo.createEmployee(user.id, input);
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
