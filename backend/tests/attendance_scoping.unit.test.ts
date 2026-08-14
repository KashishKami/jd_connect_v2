import { describe, it, expect, vi } from 'vitest';
import { AttendanceService } from '../src/services/attendance.service';
import { AttendanceRepository } from '../src/repositories/attendance.repository';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('AttendanceService - Scoping Unit Tests', () => {
  it('restricts standard employee to querying only their own employee ID', async () => {
    const mockAttRepo = {
      findRecords: vi.fn().mockResolvedValue([]),
    } as unknown as AttendanceRepository;

    const mockEmpRepo = {} as unknown as EmployeeRepository;

    const service = new AttendanceService(mockAttRepo, mockEmpRepo);

    // Standard employee trying to request another employee ID should throw Error/Forbidden
    await expect(
      service.getAttendanceHistory(
        { id: 'emp-1', roles: ['employee'] },
        { employee_id: 'emp-2' }
      )
    ).rejects.toThrow('Forbidden: You can only view your own attendance records');

    expect(mockAttRepo.findRecords).not.toHaveBeenCalled();
  });

  it('allows employee to query their own ID and calls repository with forced employee_id', async () => {
    const mockAttRepo = {
      findRecords: vi.fn().mockResolvedValue([{ id: 'att-1', employee_id: 'emp-1' }]),
    } as unknown as AttendanceRepository;

    const mockEmpRepo = {} as unknown as EmployeeRepository;

    const service = new AttendanceService(mockAttRepo, mockEmpRepo);

    const records = await service.getAttendanceHistory(
      { id: 'emp-1', roles: ['employee'] },
      {}
    );

    expect(records.length).toBe(1);
    expect(mockAttRepo.findRecords).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: 'emp-1' })
    );
  });
});
