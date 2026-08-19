import { describe, it, expect, vi } from 'vitest';
import { BreakService } from '../src/services/break.service';
import { BreakRepository } from '../src/repositories/break.repository';
import { AttendanceRepository } from '../src/repositories/attendance.repository';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('BreakService - History Scoping Unit Tests', () => {
  it('restricts standard employee to querying only their own employee ID', async () => {
    const mockBreakRepo = {
      findRecords: vi.fn().mockResolvedValue([]),
    } as unknown as BreakRepository;

    const service = new BreakService(
      mockBreakRepo,
      {} as unknown as AttendanceRepository,
      {} as unknown as EmployeeRepository
    );

    await expect(
      service.getBreakHistory(
        { id: 'emp-1', roles: ['employee'] },
        { employee_id: 'emp-2' }
      )
    ).rejects.toThrow('Forbidden: You can only view your own break records');

    expect(mockBreakRepo.findRecords).not.toHaveBeenCalled();
  });

  it('allows employee to query own break history', async () => {
    const mockBreakRepo = {
      findRecords: vi.fn().mockResolvedValue([{ id: 'brk-1', employee_id: 'emp-1' }]),
    } as unknown as BreakRepository;

    const service = new BreakService(
      mockBreakRepo,
      {} as unknown as AttendanceRepository,
      {} as unknown as EmployeeRepository
    );

    const records = await service.getBreakHistory(
      { id: 'emp-1', roles: ['employee'] },
      {}
    );

    expect(records.length).toBe(1);
    expect(mockBreakRepo.findRecords).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: 'emp-1' })
    );
  });

  it('resolves employee_id=me to actor.id even for super_admin or admin', async () => {
    const mockBreakRepo = {
      findRecords: vi.fn().mockResolvedValue([{ id: 'brk-admin', employee_id: 'admin-1' }]),
    } as unknown as BreakRepository;

    const service = new BreakService(
      mockBreakRepo,
      {} as unknown as AttendanceRepository,
      {} as unknown as EmployeeRepository
    );

    const records = await service.getBreakHistory(
      { id: 'admin-1', roles: ['super_admin'] },
      { employee_id: 'me' }
    );

    expect(records.length).toBe(1);
    expect(mockBreakRepo.findRecords).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: 'admin-1' })
    );
  });
});

