import { attendanceRepository, AttendanceRepository, FindAttendanceFilters } from '../repositories/attendance.repository';
import { employeeRepository, EmployeeRepository } from '../repositories/employee.repository';
import { breakRepository, BreakRepository } from '../repositories/break.repository';
import { AttendanceRecord, AttendanceStatus } from '../types/attendance';

export class AlreadyClockedInError extends Error {
  constructor() {
    super('Already clocked in for today');
    this.name = 'AlreadyClockedInError';
  }
}

export class NoOpenClockInError extends Error {
  constructor() {
    super('No open clock-in record found for today');
    this.name = 'NoOpenClockInError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export const ATTENDANCE_THRESHOLDS = {
  PRESENT_BUFFER_MINUTES: 15,
  LATE_CUTOFF_MINUTES: 30,
  MIN_HOURS_FOR_FULL_DAY: 6,
} as const;

export function getESTWorkDate(date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function computeAttendanceStatus(
  clockInTime: Date,
  shiftStartTime: Date,
  hoursWorked: number
): { status: AttendanceStatus; isLate: boolean } {
  const minutesLate = Math.floor((clockInTime.getTime() - shiftStartTime.getTime()) / 60000);

  if (hoursWorked < ATTENDANCE_THRESHOLDS.MIN_HOURS_FOR_FULL_DAY) {
    return { status: 'half_day', isLate: false };
  }
  if (minutesLate > ATTENDANCE_THRESHOLDS.LATE_CUTOFF_MINUTES) {
    return { status: 'half_day', isLate: false };
  }
  if (minutesLate > ATTENDANCE_THRESHOLDS.PRESENT_BUFFER_MINUTES) {
    return { status: 'late', isLate: true };
  }
  return { status: 'present', isLate: false };
}

export class AttendanceService {
  constructor(
    private attRepo: AttendanceRepository = attendanceRepository,
    private empRepo: EmployeeRepository = employeeRepository,
    private breakRepo: BreakRepository = breakRepository
  ) {}

  async getStatus(employeeId: string): Promise<{
    status: 'off_shift' | 'clocked_in' | 'on_break';
    clock_in_at?: string | undefined;
    break_start_at?: string | undefined;
  }> {
    const todayEST = getESTWorkDate();
    const openRecord = await this.attRepo.findOpenRecord(employeeId, todayEST);
    if (!openRecord) {
      return { status: 'off_shift' };
    }

    const activeBreak = await this.breakRepo.findActiveBreak(employeeId);
    if (activeBreak) {
      return {
        status: 'on_break',
        clock_in_at: openRecord.clock_in_at ? new Date(openRecord.clock_in_at).toISOString() : undefined,
        break_start_at: activeBreak.start_at ? new Date(activeBreak.start_at).toISOString() : undefined,
      };
    }

    return {
      status: 'clocked_in',
      clock_in_at: openRecord.clock_in_at ? new Date(openRecord.clock_in_at).toISOString() : undefined,
    };
  }

  async getLiveMonitorSummary(): Promise<{
    working_count: number;
    on_break_count: number;
    total_clocked_in: number;
  }> {
    const todayEST = getESTWorkDate();
    return await this.attRepo.getLiveMonitorSummary(todayEST);
  }

  async getTodaySummary(): Promise<{
    present: number;
    on_break: number;
    absent: number;
    late: number;
    half_day: number;
    total_employees: number;
  }> {
    const summary = await this.attRepo.getTodaySummary();
    const absent = Math.max(0, summary.total_employees - summary.present);
    return {
      ...summary,
      absent,
    };
  }

  async clockIn(zulipUserId: number): Promise<AttendanceRecord> {
    const employee = await this.empRepo.findByZulipUserId(zulipUserId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const todayEST = getESTWorkDate();

    // Check for open record today
    const openRecord = await this.attRepo.findOpenRecord(employee.id, todayEST);
    if (openRecord) {
      throw new AlreadyClockedInError();
    }

    const now = new Date();
    return await this.attRepo.createClockIn(employee.id, todayEST, now);
  }

  async clockOut(zulipUserId: number): Promise<AttendanceRecord> {
    const employee = await this.empRepo.findByZulipUserId(zulipUserId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const todayEST = getESTWorkDate();
    const openRecord = await this.attRepo.findOpenRecord(employee.id, todayEST);
    if (!openRecord) {
      throw new NoOpenClockInError();
    }

    const clockOutAt = new Date();
    const clockInAt = new Date(openRecord.clock_in_at!);
    const hoursWorked = Math.round(((clockOutAt.getTime() - clockInAt.getTime()) / 3600000) * 100) / 100;

    // Shift start reference for today (09:00 AM EST)
    const shiftStart = new Date(`${todayEST}T09:00:00-05:00`);

    const { status, isLate } = computeAttendanceStatus(clockInAt, shiftStart, hoursWorked);

    return await this.attRepo.updateClockOut(openRecord.id, clockOutAt, hoursWorked, status, isLate);
  }

  async getAttendanceHistory(
    actor: { id: string; roles: string[] },
    filters: { employee_id?: string | undefined; from?: string | undefined; to?: string | undefined }
  ): Promise<AttendanceRecord[]> {
    const isSuperAdminOrAdmin = actor.roles.some((r) => r === 'super_admin' || r === 'admin');

    let targetEmployeeId = filters.employee_id;

    if (targetEmployeeId === 'me') {
      targetEmployeeId = actor.id;
    } else if (!isSuperAdminOrAdmin) {
      if (targetEmployeeId && targetEmployeeId !== actor.id) {
        throw new ForbiddenError('Forbidden: You can only view your own attendance records');
      }
      targetEmployeeId = actor.id;
    }


    const repoFilters: FindAttendanceFilters = {
      employee_id: targetEmployeeId,
      fromDate: filters.from,
      toDate: filters.to,
    };

    return await this.attRepo.findRecords(repoFilters);
  }
}

export const attendanceService = new AttendanceService();
