import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatESTTime, formatESTDate } from '../src/lib/format';
import { setUserPermissions, setAuthToken } from '../src/lib/auth';
import { renderAttendanceConsole } from '../src/pages/attendance';
import { renderAttendanceAuditPage } from '../src/pages/attendance_audit';
import { renderBreaksAuditPage } from '../src/pages/breaks_audit';

describe('EST Timezone & Pagination Tests', () => {
  describe('formatESTTime UTC Conversion & 12-Hour AM/PM Edge Cases', () => {
    it('formats 04:00:00 UTC as 12:00:00 AM (Midnight EST/EDT)', () => {
      const formatted = formatESTTime('2026-08-21T04:00:00Z');
      expect(formatted).toBe('12:00:00 AM');
    });

    it('formats 16:00:00 UTC as 12:00:00 PM (Noon EST/EDT)', () => {
      const formatted = formatESTTime('2026-08-21T16:00:00Z');
      expect(formatted).toBe('12:00:00 PM');
    });

    it('formats 00:00:00 UTC as 08:00:00 PM of previous evening in EST/EDT', () => {
      const formatted = formatESTTime('2026-08-21T00:00:00Z');
      expect(formatted).toBe('08:00:00 PM');
    });

    it('formats 12:00:00 UTC as 08:00:00 AM in EST/EDT', () => {
      const formatted = formatESTTime('2026-08-21T12:00:00Z');
      expect(formatted).toBe('08:00:00 AM');
    });

    it('handles null, undefined, and invalid date strings gracefully', () => {
      expect(formatESTTime(null)).toBe('-');
      expect(formatESTTime(undefined)).toBe('-');
      expect(formatESTTime('invalid-date')).toBe('-');
    });
  });

  describe('formatESTDate Edge Cases', () => {
    it('preserves plain YYYY-MM-DD date strings without backward UTC shift', () => {
      expect(formatESTDate('2026-08-21')).toBe('2026-08-21');
    });

    it('converts ISO timestamp to correct EST work date', () => {
      expect(formatESTDate('2026-08-21T01:00:00Z')).toBe('2026-08-20');
      expect(formatESTDate('2026-08-21T15:00:00Z')).toBe('2026-08-21');
    });

    it('handles null, undefined, and invalid date strings gracefully', () => {
      expect(formatESTDate(null)).toBe('-');
      expect(formatESTDate(undefined)).toBe('-');
      expect(formatESTDate('invalid-date')).toBe('invalid-date');
    });
  });

  describe('20-Record Pagination for Attendance Audit & Breaks Audit', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      localStorage.clear();
      setAuthToken('mock-test-jwt-token');
      vi.restoreAllMocks();
    });

    it('paginates 25 attendance audit logs into 2 pages of 20 records', async () => {
      setUserPermissions(['portal.attendance_audit', 'attendance.view_all']);

      const mockLogs = Array.from({ length: 25 }, (_, i) => ({
        id: `att-${i + 1}`,
        employee_id: `emp-${i + 1}`,
        employee_name: `Employee ${i + 1}`,
        work_date: '2026-08-21',
        clock_in_at: '2026-08-21T13:00:00Z',
        clock_out_at: '2026-08-21T21:00:00Z',
        hours_worked: 8,
        status: 'present',
      }));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLogs),
      });
      vi.stubGlobal('fetch', mockFetch);

      renderAttendanceAuditPage(container);
      await new Promise((r) => setTimeout(r, 50));

      const rowsPage1 = container.querySelectorAll('#attendanceAuditTableBody tr');
      expect(rowsPage1.length).toBe(20);

      const pageInfo = container.querySelector('#auditPageInfo');
      expect(pageInfo?.textContent).toBe('Page 1 of 2');

      const nextBtn = container.querySelector('#auditNext') as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(false);

      nextBtn.click();
      await new Promise((r) => setTimeout(r, 10));

      const rowsPage2 = container.querySelectorAll('#attendanceAuditTableBody tr');
      expect(rowsPage2.length).toBe(5);
      expect(pageInfo?.textContent).toBe('Page 2 of 2');
    });

    it('paginates 25 breaks audit logs into 2 pages of 20 records', async () => {
      setUserPermissions(['portal.breaks_audit', 'breaks.view_all']);

      const mockBreakLogs = Array.from({ length: 25 }, (_, i) => ({
        id: `brk-${i + 1}`,
        employee_id: `emp-${i + 1}`,
        employee_name: `Employee ${i + 1}`,
        break_type_name: 'Tea Break',
        start_at: '2026-08-21T14:00:00Z',
        end_at: '2026-08-21T14:15:00Z',
        duration_minutes: 15,
        status: 'completed',
      }));

      const mockFetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/break-types')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBreakLogs) } as Response);
      });
      vi.stubGlobal('fetch', mockFetch);

      renderBreaksAuditPage(container);
      await new Promise((r) => setTimeout(r, 50));

      const rowsPage1 = container.querySelectorAll('#breaksAuditTableBody tr');
      expect(rowsPage1.length).toBe(20);

      const pageInfo = container.querySelector('#breakAuditPageInfo');
      expect(pageInfo?.textContent).toBe('Page 1 of 2');
    });
  });

  describe('10-Record Pagination for Attendance Console Logs', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      localStorage.clear();
      setAuthToken('mock-test-jwt-token');
      vi.restoreAllMocks();
    });

    it('paginates personal attendance logs to 10 records per page', async () => {
      setUserPermissions(['portal.attendance', 'attendance.view_own']);

      const mockUserLogs = Array.from({ length: 15 }, (_, i) => ({
        work_date: `2026-08-${String(i + 1).padStart(2, '0')}`,
        clock_in_at: '2026-08-21T13:00:00Z',
        clock_out_at: '2026-08-21T21:00:00Z',
        hours_worked: 8,
        status: 'present',
      }));

      const mockFetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/attendance/status')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'off_shift' }) } as Response);
        }
        if (urlStr.includes('/break-types')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
        }
        if (urlStr.includes('/attendance')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUserLogs) } as Response);
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      });
      vi.stubGlobal('fetch', mockFetch);

      renderAttendanceConsole(container);
      await new Promise((r) => setTimeout(r, 50));

      const rowsPage1 = container.querySelectorAll('#attTableBody tr');
      expect(rowsPage1.length).toBe(10);

      const attPageInfo = container.querySelector('#attPageInfo');
      expect(attPageInfo?.textContent).toBe('Page 1 of 2');
    });
  });
});
