import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';

interface AttendanceAuditRow {
  id: string;
  employee_id: string;
  employee_name?: string;
  full_name?: string;
  alias?: string;
  employee_email?: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at?: string;
  hours_worked?: number;
  status: string;
  is_late?: boolean;
}

export function renderAttendanceAuditPage(container: HTMLElement): void {
  if (!guardRoute('portal.attendance_audit', container)) {
    return;
  }

  container.innerHTML = `
    <div class="main-content">
      <div class="section-header">
        <h2>Attendance Audit & History</h2>
      </div>

      <div class="filter-bar">
        <input type="text" id="auditSearch" class="input-search" placeholder="Filter by employee name or alias..." />
        <input type="date" id="auditDate" class="select-filter" />
        <select id="auditStatus" class="select-filter">
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
          <option value="absent">Absent</option>
          <option value="leave">Leave</option>
        </select>
        <button id="auditTodayBtn" class="btn btn-secondary">Today</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Work Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours Worked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="attendanceAuditTableBody">
            <tr><td colspan="6" style="text-align:center;">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-bar">
        <button id="auditPrev" class="btn btn-secondary" disabled>Previous</button>
        <span id="auditPageInfo" class="page-indicator">Page 1</span>
        <button id="auditNext" class="btn btn-secondary" disabled>Next</button>
      </div>
    </div>
  `;

  initAttendanceAuditLogic(container);
}

function initAttendanceAuditLogic(container: HTMLElement): void {
  const tbody = container.querySelector('#attendanceAuditTableBody') as HTMLTableSectionElement;
  const searchInput = container.querySelector('#auditSearch') as HTMLInputElement;
  const dateInput = container.querySelector('#auditDate') as HTMLInputElement;
  const statusSelect = container.querySelector('#auditStatus') as HTMLSelectElement;
  const todayBtn = container.querySelector('#auditTodayBtn') as HTMLButtonElement;

  async function loadAuditLogs() {
    try {
      const params = new URLSearchParams();
      if (searchInput?.value.trim()) params.set('search', searchInput.value.trim());
      if (dateInput?.value) {
        params.set('from', dateInput.value);
        params.set('to', dateInput.value);
      }
      if (statusSelect?.value) params.set('status', statusSelect.value);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const logs = await apiFetch<AttendanceAuditRow[]>(`/attendance${queryString}`);

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No attendance records found.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map((l) => {
        const empName = l.employee_name || l.full_name || 'Employee';
        const isLate = l.is_late || l.status === 'late';
        const badgeClass = l.status === 'present' ? 'badge-success' : (isLate ? 'badge-warning' : 'badge-purple');

        return `
          <tr>
            <td><strong>${empName}</strong></td>
            <td>${l.work_date}</td>
            <td>${l.clock_in_at ? new Date(l.clock_in_at).toLocaleTimeString() : '-'}</td>
            <td>${l.clock_out_at ? new Date(l.clock_out_at).toLocaleTimeString() : '-'}</td>
            <td>${l.hours_worked ?? '-'}</td>
            <td><span class="badge ${badgeClass}">${l.status}${isLate ? ' (Late)' : ''}</span></td>
          </tr>
        `;
      }).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--accent-red);">Failed to load audit records.</td></tr>';
    }
  }

  if (todayBtn) {
    todayBtn.onclick = () => {
      if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }
      loadAuditLogs();
    };
  }

  if (searchInput) searchInput.oninput = () => loadAuditLogs();
  if (dateInput) dateInput.onchange = () => loadAuditLogs();
  if (statusSelect) statusSelect.onchange = () => loadAuditLogs();

  loadAuditLogs();
}
