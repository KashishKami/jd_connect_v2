import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '../src/services/attendance.service';
import { BreakService } from '../src/services/break.service';
import { permissionsService } from '../src/services/permissions.service';

vi.mock('../src/repositories/attendance.repository');
vi.mock('../src/repositories/break.repository');

describe('Team Scoping Unit Tests (attendance.view_team & breaks.view_team)', () => {
  let attendanceService: AttendanceService;
  let breakService: BreakService;
  let mockAttRepo: { findRecords: ReturnType<typeof vi.fn> };
  let mockBreakRepo: { findRecords: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    attendanceService = new AttendanceService();
    breakService = new BreakService();

    mockAttRepo = (attendanceService as unknown as { attRepo: { findRecords: ReturnType<typeof vi.fn> } }).attRepo;
    mockBreakRepo = (breakService as unknown as { breakRepo: { findRecords: ReturnType<typeof vi.fn> } }).breakRepo;

    mockAttRepo.findRecords = vi.fn().mockResolvedValue([]);
    mockBreakRepo.findRecords = vi.fn().mockResolvedValue([]);
  });

  it('passes team_actor_id to attendance repository when actor has attendance.view_team permission', async () => {
    vi.spyOn(permissionsService, 'getMyPermissions').mockResolvedValue(['portal.attendance_audit', 'attendance.view_team']);

    await attendanceService.getAttendanceHistory(
      { id: 'mgr-123', roles: ['manager'] },
      {}
    );

    expect(mockAttRepo.findRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        team_actor_id: 'mgr-123',
        employee_id: undefined,
      })
    );
  });

  it('passes team_actor_id to break repository when actor has breaks.view_team permission', async () => {
    vi.spyOn(permissionsService, 'getMyPermissions').mockResolvedValue(['portal.breaks_audit', 'breaks.view_team']);

    await breakService.getBreakHistory(
      { id: 'mgr-123', roles: ['manager'] },
      {}
    );

    expect(mockBreakRepo.findRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        team_actor_id: 'mgr-123',
        employee_id: undefined,
      })
    );
  });
});
