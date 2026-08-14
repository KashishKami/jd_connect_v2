import { describe, it, expect, vi } from 'vitest';
import { EmployeeService, EmployeeNotFoundError } from '../src/services/employee.service';
import { UserRepository } from '../src/repositories/user.repository';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('EmployeeService.resetPassword Unit Tests', () => {
  it('throws EmployeeNotFoundError when employee ID does not exist', async () => {
    const mockUserRepo = {
      updatePasswordHash: vi.fn(),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);

    await expect(service.resetPassword('non-existent-id', 'NewPass123!')).rejects.toThrow(
      EmployeeNotFoundError
    );
    expect(mockEmpRepo.findById).toHaveBeenCalledWith('non-existent-id');
    expect(mockUserRepo.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('updates password hash successfully when employee exists', async () => {
    const mockUserRepo = {
      updatePasswordHash: vi.fn().mockResolvedValue(true),
    } as unknown as UserRepository;

    const mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'emp-123',
        auth_user_id: 'auth-user-456',
      }),
    } as unknown as EmployeeRepository;

    const service = new EmployeeService(mockUserRepo, mockEmpRepo);

    await service.resetPassword('emp-123', 'NewPass123!');

    expect(mockEmpRepo.findById).toHaveBeenCalledWith('emp-123');
    expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith(
      'auth-user-456',
      expect.stringMatching(/^\$2[ayb]\$/)
    );
  });
});
