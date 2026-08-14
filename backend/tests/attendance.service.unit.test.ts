import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService, AlreadyClockedInError } from '../src/services/attendance.service';
import { attendanceRepository } from '../src/repositories/attendance.repository';
import { employeeRepository } from '../src/repositories/employee.repository';
import { AttendanceRecord } from '../src/types/attendance';
import { EmployeeResponse } from '../src/types/employee';

vi.mock('../src/repositories/attendance.repository');
vi.mock('../src/repositories/employee.repository');

describe('AttendanceService - Unit Tests', () => {
  let attendanceService: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    attendanceService = new AttendanceService();
  });

  describe('clockIn', () => {
    it('throws error if employee is not found', async () => {
      vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(null);

      await expect(attendanceService.clockIn(999)).rejects.toThrow('Employee not found');
      expect(employeeRepository.findByZulipUserId).toHaveBeenCalledWith(999);
    });

    it('throws AlreadyClockedInError if an open clock-in record already exists for today', async () => {
      const mockEmp = { id: 'emp-123', zulip_user_id: 101 } as unknown as EmployeeResponse;
      const mockOpenRecord = {
        id: 'att-1',
        employee_id: 'emp-123',
        work_date: '2026-08-15',
      } as unknown as AttendanceRecord;

      vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(mockEmp);
      vi.mocked(attendanceRepository.findOpenRecord).mockResolvedValue(mockOpenRecord);

      await expect(attendanceService.clockIn(101)).rejects.toThrow(AlreadyClockedInError);
      expect(attendanceRepository.findOpenRecord).toHaveBeenCalledWith('emp-123', expect.any(String));
      expect(attendanceRepository.createClockIn).not.toHaveBeenCalled();
    });

    it('creates and returns a new clock-in record if no open record exists', async () => {
      const mockEmp = { id: 'emp-123', zulip_user_id: 101 } as unknown as EmployeeResponse;
      const mockCreatedRecord = {
        id: 'att-2',
        employee_id: 'emp-123',
        work_date: '2026-08-15',
        clock_in_at: new Date(),
        clock_out_at: null,
        status: 'absent',
      } as unknown as AttendanceRecord;

      vi.mocked(employeeRepository.findByZulipUserId).mockResolvedValue(mockEmp);
      vi.mocked(attendanceRepository.findOpenRecord).mockResolvedValue(null);
      vi.mocked(attendanceRepository.createClockIn).mockResolvedValue(mockCreatedRecord);

      const result = await attendanceService.clockIn(101);

      expect(result).toEqual(mockCreatedRecord);
      expect(attendanceRepository.createClockIn).toHaveBeenCalledWith('emp-123', expect.any(String), expect.any(Date));
    });
  });
});
