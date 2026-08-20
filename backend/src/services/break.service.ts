import { breakRepository, BreakRepository, FindBreakFilters } from '../repositories/break.repository';
import { attendanceRepository, AttendanceRepository } from '../repositories/attendance.repository';
import { employeeRepository, EmployeeRepository } from '../repositories/employee.repository';
import { getESTWorkDate } from './attendance.service';
import { BreakRecord, BreakStatus, BreakType } from '../types/break';

export class NotClockedInError extends Error {
  constructor() {
    super('You must be clocked in to start a break');
    this.name = 'NotClockedInError';
  }
}

export class AlreadyOnBreakError extends Error {
  constructor() {
    super('Already on an active break');
    this.name = 'AlreadyOnBreakError';
  }
}

export class InvalidBreakTypeError extends Error {
  constructor() {
    super('Invalid or inactive break type key');
    this.name = 'InvalidBreakTypeError';
  }
}

export class NoActiveBreakError extends Error {
  constructor() {
    super('No active break found to end');
    this.name = 'NoActiveBreakError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function computeBreakDuration(startAt: Date, endAt: Date): number {
  return Math.round(((endAt.getTime() - startAt.getTime()) / 60000) * 100) / 100;
}

export function computeBreakStatus(
  durationMinutes: number,
  limitMinutes: number | null
): 'completed' | 'exceeded' {
  if (limitMinutes === null) return 'completed';
  return durationMinutes > limitMinutes ? 'exceeded' : 'completed';
}

export class BreakService {
  constructor(
    private breakRepo: BreakRepository = breakRepository,
    private attRepo: AttendanceRepository = attendanceRepository,
    private empRepo: EmployeeRepository = employeeRepository
  ) {}

  async startBreak(zulipUserId: number, breakTypeKey: string): Promise<BreakRecord> {
    const employee = await this.empRepo.findByZulipUserId(zulipUserId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Verify employee is clocked in today
    const todayEST = getESTWorkDate();
    const openAttendance = await this.attRepo.findOpenRecord(employee.id, todayEST);
    if (!openAttendance) {
      throw new NotClockedInError();
    }

    // Verify no active break exists
    const activeBreak = await this.breakRepo.findActiveBreak(employee.id);
    if (activeBreak) {
      throw new AlreadyOnBreakError();
    }

    // Fetch break type
    const breakType = await this.breakRepo.findBreakTypeByKey(breakTypeKey);
    if (!breakType) {
      throw new InvalidBreakTypeError();
    }

    // Calculate effective limit minutes
    const limitMinutes = await this.breakRepo.getEffectiveLimit(
      breakType.id,
      employee.centre_id,
      employee.department_id
    );

    return await this.breakRepo.createBreak({
      employee_id: employee.id,
      break_type_id: breakType.id,
      department_id: employee.department_id,
      centre_id: employee.centre_id,
      limit_minutes: limitMinutes,
    });
  }

  async endBreak(zulipUserId: number): Promise<BreakRecord> {
    const employee = await this.empRepo.findByZulipUserId(zulipUserId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const activeBreak = await this.breakRepo.findActiveBreak(employee.id);
    if (!activeBreak) {
      throw new NoActiveBreakError();
    }

    const endAt = new Date();
    const startAt = new Date(activeBreak.start_at);
    const durationMinutes = computeBreakDuration(startAt, endAt);
    const status = computeBreakStatus(durationMinutes, activeBreak.limit_minutes);

    return await this.breakRepo.updateEndBreak(activeBreak.id, endAt, durationMinutes, status);
  }

  async getBreakHistory(
    actor: { id: string; roles: string[] },
    filters: {
      employee_id?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
      status?: BreakStatus | undefined;
      search?: string | undefined;
    }
  ): Promise<BreakRecord[]> {
    const isSuperAdminOrAdmin = actor.roles.some((r) => r === 'super_admin' || r === 'admin');

    let targetEmployeeId = filters.employee_id;

    if (targetEmployeeId === 'me') {
      targetEmployeeId = actor.id;
    } else if (!isSuperAdminOrAdmin) {
      if (targetEmployeeId && targetEmployeeId !== actor.id) {
        throw new ForbiddenError('Forbidden: You can only view your own break records');
      }
      targetEmployeeId = actor.id;
    }

    const repoFilters: FindBreakFilters = {
      employee_id: targetEmployeeId,
      fromDate: filters.from,
      toDate: filters.to,
      status: filters.status,
      search: filters.search,
    };

    return await this.breakRepo.findRecords(repoFilters);
  }

  async getBreakTypes(isActive = true): Promise<BreakType[]> {
    return await this.breakRepo.listBreakTypes(isActive);
  }
}

export const breakService = new BreakService();
