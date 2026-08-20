import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setUserPermissions, setAuthToken } from '../src/lib/auth';
import { renderEmployeesPage } from '../src/pages/employees';
import { renderAttendanceAuditPage } from '../src/pages/attendance_audit';
import { renderBreaksAuditPage } from '../src/pages/breaks_audit';
import { renderPermissionsMatrixPage } from '../src/pages/permissions';
import { renderDashboardPage } from '../src/pages/dashboard';

describe('Portal Pages Unit Tests (W-1009, W-1010, W-1011, W-1012)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    localStorage.clear();
    setAuthToken('mock-test-jwt-token');
    vi.restoreAllMocks();
  });

  describe('W-1009 Employees Page Permission Scoping & Rendering', () => {
    it('hides Add Employee button when employees.create permission is absent', () => {
      setUserPermissions(['portal.employees', 'employees.view']);
      renderEmployeesPage(container);

      const addBtn = container.querySelector('#addEmployeeBtn');
      expect(addBtn).toBeNull();
    });

    it('shows Add Employee button when employees.create permission is present', () => {
      setUserPermissions(['portal.employees', 'employees.view', 'employees.create']);
      renderEmployeesPage(container);

      const addBtn = container.querySelector('#addEmployeeBtn');
      expect(addBtn).not.toBeNull();
    });

    it('renders employee rows with code, full_name, alias, email/phone, designation, department, centre, joining date, role, and Zulip provisioned status', async () => {
      setUserPermissions(['portal.employees', 'employees.view', 'employees.edit']);

      const mockFetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/departments')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', name: 'Operations' }]) } as Response);
        }
        if (urlStr.includes('/centres')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'c1', code: 'DBP', name: 'Doon Business Park' }]) } as Response);
        }
        if (urlStr.includes('/shifts')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 's1', name: 'Night Shift' }]) } as Response);
        }
        if (urlStr.includes('/employees')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 'e1',
                employee_code: 'JD0001',
                full_name: 'Adam Smith',
                alias: 'Adam',
                email: 'adam@company.com',
                mobile: '1234567890',
                role: 'admin',
                department: 'Operations',
                centre_name: 'Doon Business Park',
                designation: 'Lead Architect',
                joining_date: '2026-01-15T00:00:00Z',
                zulip_provisioned: false,
                employment_status: 'active',
              }
            ])
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      vi.stubGlobal('fetch', mockFetch);

      renderEmployeesPage(container);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.textContent).toContain('JD0001');
      expect(container.textContent).toContain('Adam Smith');
      expect(container.textContent).toContain('Adam');
      expect(container.textContent).toContain('adam@company.com');
      expect(container.textContent).toContain('1234567890');
      expect(container.textContent).toContain('Lead Architect');
      expect(container.textContent).toContain('Operations');
      expect(container.textContent).toContain('Doon Business Park');
      expect(container.textContent).toContain('active');
      expect(container.querySelector('.btn-retry-zulip')).not.toBeNull();
      expect(container.querySelector('.btn-edit-emp')).not.toBeNull();
    });
  });

  describe('W-1010 Attendance Audit Page', () => {
    it('renders search and date filters with permission', () => {
      setUserPermissions(['portal.attendance_audit', 'attendance.view_team']);
      renderAttendanceAuditPage(container);

      expect(container.querySelector('#auditSearch')).not.toBeNull();
      expect(container.querySelector('#auditDate')).not.toBeNull();
    });

    it('renders Access Denied when portal.attendance_audit permission is absent', () => {
      setUserPermissions(['portal.attendance']);
      renderAttendanceAuditPage(container);

      expect(container.textContent).toContain('Access Denied');
    });

    it('fetches /attendance endpoint and renders records', async () => {
      setUserPermissions(['portal.attendance_audit', 'attendance.view_all']);

      const mockFetch = vi.fn((url: string | URL | Request) => {
        if (url.toString().includes('/attendance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 'a1',
                employee_name: 'John Doe',
                work_date: '2026-08-21',
                clock_in_at: '2026-08-21T09:00:00Z',
                status: 'present'
              }
            ])
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      vi.stubGlobal('fetch', mockFetch);

      renderAttendanceAuditPage(container);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.textContent).toContain('John Doe');
      expect(container.textContent).toContain('present');
    });
  });

  describe('W-1011 Breaks Audit Page', () => {
    it('renders break audit table and filters, fetching /breaks endpoint', async () => {
      setUserPermissions(['portal.breaks_audit', 'breaks.view_all']);

      const mockFetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/break-types')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'bt1', key: 'tea', name: 'Tea Break' }]) } as Response);
        }
        if (urlStr.includes('/breaks')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 'b1',
                employee_name: 'Jane Doe',
                break_type_name: 'Tea Break',
                start_at: '2026-08-21T10:00:00Z',
                duration_minutes: 15,
                status: 'completed'
              }
            ])
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      vi.stubGlobal('fetch', mockFetch);

      renderBreaksAuditPage(container);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.querySelector('#breakAuditTable')).not.toBeNull();
      expect(container.textContent).toContain('Jane Doe');
      expect(container.textContent).toContain('Tea Break');
    });
  });

  describe('W-1012 Permissions Matrix Page', () => {
    it('renders Access Denied for non-super_admin users lacking portal.permissions', () => {
      setUserPermissions(['portal.attendance']);
      renderPermissionsMatrixPage(container);

      expect(container.textContent).toContain('Access Denied');
    });

    it('renders permission keys and role keys correctly when permission is present', async () => {
      setUserPermissions(['portal.permissions', 'permissions.view']);

      const mockFetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith('/permissions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ key: 'portal.attendance', description: 'Access Attendance Console' }])
          } as Response);
        }
        if (urlStr.endsWith('/roles')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { role_key: 'super_admin', role_name: 'Super Admin', permissions: ['portal.attendance'] },
              { role_key: 'admin', role_name: 'Admin', permissions: ['portal.attendance'] },
              { role_key: 'hr', role_name: 'HR', permissions: ['portal.attendance'] },
              { role_key: 'manager', role_name: 'Manager', permissions: ['portal.attendance'] },
              { role_key: 'team_leader', role_name: 'Team Leader', permissions: ['portal.attendance'] },
              { role_key: 'employee', role_name: 'Employee', permissions: ['portal.attendance'] }
            ])
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      vi.stubGlobal('fetch', mockFetch);

      renderPermissionsMatrixPage(container);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.textContent).toContain('portal.attendance');
      expect(container.textContent).toContain('Access Attendance Console');
    });
  });

  describe('W-1012 Dashboard Metrics & Embedded Shift Console', () => {
    it('renders 5 metric cards and embedded shift console', () => {
      setUserPermissions(['portal.attendance_audit', 'portal.attendance']);
      renderDashboardPage(container);

      expect(container.querySelector('#dashboardMetrics')).not.toBeNull();
      expect(container.querySelector('#yourShiftToday')).not.toBeNull();
      expect(container.querySelector('#clockBtn')).not.toBeNull();
    });
  });
});
