import { describe, it, expect, vi } from 'vitest';
import { AttendanceService } from '../src/services/attendance.service';
import { AttendanceRepository } from '../src/repositories/attendance.repository';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('AttendanceService getTodaySummary Unit Tests', () => {
  it('returns today summary metrics from repository', async () => {
    const mockAttRepo = {
      getTodaySummary: vi.fn().mockResolvedValue({
        present: 10,
        on_break: 2,
        total_employees: 25,
        late: 3,
        half_day: 1,
      }),
    } as unknown as AttendanceRepository;

    const mockEmpRepo = {} as unknown as EmployeeRepository;

    const service = new AttendanceService(mockAttRepo, mockEmpRepo);
    const summary = await service.getTodaySummary();

    expect(mockAttRepo.getTodaySummary).toHaveBeenCalled();
    expect(summary).toEqual({
      present: 10,
      on_break: 2,
      late: 3,
      half_day: 1,
      total_employees: 25,
    });
  });
});
