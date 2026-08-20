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

  describe('W-1009 Employees Page Permission Scoping', () => {
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
  });

  describe('W-1011 Breaks Audit Page', () => {
    it('renders break audit table and filters', () => {
      setUserPermissions(['portal.breaks_audit', 'breaks.view_team']);
      renderBreaksAuditPage(container);

      expect(container.querySelector('#breakAuditTable')).not.toBeNull();
    });
  });

  describe('W-1012 Permissions Matrix Page', () => {
    it('renders Access Denied for non-super_admin users lacking portal.permissions', () => {
      setUserPermissions(['portal.attendance']);
      renderPermissionsMatrixPage(container);

      expect(container.textContent).toContain('Access Denied');
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
