import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BreakService, NotClockedInError, AlreadyOnBreakError } from '../src/services/break.service';
import { breakRepository } from '../src/repositories/break.repository';
import { attendanceRepository } from '../src/repositories/attendance.repository';
import { employeeRepository } from '../src/repositories/employee.repository';
import { EmployeeResponse } from '../src/types/employee';
import { BreakRecord, BreakType } from '../src/types/break';
import { AttendanceRecord } from '../src/types/attendance';

vi.mock('../src/repositories/break.repository');
vi.mock('../src/repositories/attendance.repository');
vi.mock('../src/repositories/employee.repository');

describe('BreakService - startBreak Unit Tests', () => {
  let breakService: BreakService;

  beforeEach(() => {
    vi.clearAllMocks();
    breakService = new BreakService();
  });

  it('throws error if employee is not found', async () => {
    vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(null);

    await expect(breakService.startBreak(999, 'bio')).rejects.toThrow('Employee not found');
  });

  it('throws NotClockedInError if employee has no open clock-in record for today', async () => {
    const mockEmp = { id: 'emp-123', zulip_user_id: 301 } as unknown as EmployeeResponse;
    vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(mockEmp);
    vi.mocked(attendanceRepository.findOpenRecord).mockResolvedValue(null);

    await expect(breakService.startBreak(301, 'bio')).rejects.toThrow(NotClockedInError);
    expect(breakRepository.findActiveBreak).not.toHaveBeenCalled();
  });

  it('throws AlreadyOnBreakError if employee already has an active break', async () => {
    const mockEmp = { id: 'emp-123', zulip_user_id: 301 } as unknown as EmployeeResponse;
    const mockOpenAtt = { id: 'att-1', employee_id: 'emp-123' } as unknown as AttendanceRecord;
    const mockActiveBreak = { id: 'brk-1', status: 'active' } as unknown as BreakRecord;

    vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(mockEmp);
    vi.mocked(attendanceRepository.findOpenRecord).mockResolvedValue(mockOpenAtt);
    vi.mocked(breakRepository.findActiveBreak).mockResolvedValue(mockActiveBreak);

    await expect(breakService.startBreak(301, 'bio')).rejects.toThrow(AlreadyOnBreakError);
    expect(breakRepository.createBreak).not.toHaveBeenCalled();
  });

  it('creates and returns an active break record with effective limit', async () => {
    const mockEmp = { id: 'emp-123', zulip_user_id: 301, centre_id: 'c-1', department_id: 'd-1' } as unknown as EmployeeResponse;
    const mockOpenAtt = { id: 'att-1', employee_id: 'emp-123' } as unknown as AttendanceRecord;
    const mockBreakType = { id: 'bt-bio', key: 'bio', default_limit_minutes: 10 } as unknown as BreakType;
    const mockCreatedBreak = {
      id: 'brk-2',
      employee_id: 'emp-123',
      break_type_id: 'bt-bio',
      status: 'active',
      limit_minutes: 10,
    } as unknown as BreakRecord;

    vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(mockEmp);
    vi.mocked(attendanceRepository.findOpenRecord).mockResolvedValue(mockOpenAtt);
    vi.mocked(breakRepository.findActiveBreak).mockResolvedValue(null);
    vi.mocked(breakRepository.findBreakTypeByKey).mockResolvedValue(mockBreakType);
    vi.mocked(breakRepository.getEffectiveLimit).mockResolvedValue(10);
    vi.mocked(breakRepository.createBreak).mockResolvedValue(mockCreatedBreak);

    const result = await breakService.startBreak(301, 'bio');

    expect(result).toEqual(mockCreatedBreak);
    expect(breakRepository.createBreak).toHaveBeenCalledWith({
      employee_id: 'emp-123',
      break_type_id: 'bt-bio',
      department_id: 'd-1',
      centre_id: 'c-1',
      limit_minutes: 10,
    });
  });
});
