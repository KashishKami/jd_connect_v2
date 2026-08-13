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
}

export const employeeService = new EmployeeService();
