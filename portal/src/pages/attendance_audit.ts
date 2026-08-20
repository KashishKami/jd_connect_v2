import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';

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
          <option value="clocked_in">Clocked In</option>
          <option value="clocked_out">Clocked Out</option>
          <option value="on_break">On Break</option>
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
      const logs = await apiFetch<Array<{
        first_name?: string;
        last_name?: string;
        email?: string;
        work_date: string;
        clock_in_at: string;
        clock_out_at?: string;
        hours_worked?: number;
        status: string;
      }>>('/attendance/audit');

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No attendance records found.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td><strong>${l.first_name || 'Employee'} ${l.last_name || ''}</strong></td>
          <td>${l.work_date}</td>
          <td>${l.clock_in_at ? new Date(l.clock_in_at).toLocaleTimeString() : '-'}</td>
          <td>${l.clock_out_at ? new Date(l.clock_out_at).toLocaleTimeString() : '-'}</td>
          <td>${l.hours_worked ?? '-'}</td>
          <td><span class="badge badge-purple">${l.status}</span></td>
        </tr>
      `).join('');
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
