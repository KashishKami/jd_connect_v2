import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { formatESTTime } from '../lib/format';

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
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">ℹ️ All dates and times are displayed in EST (Eastern Standard Time)</span>
      </div>

      <div class="filter-bar">
        <input type="text" id="auditSearch" class="input-search" placeholder="Filter by employee name or alias..." />
        <input type="date" id="auditDate" class="select-filter" />
        <select id="auditStatus" class="select-filter">
          <option value="">All Statuses</option>
          <option value="logged_in">Logged in</option>
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

  const prevBtn = container.querySelector('#auditPrev') as HTMLButtonElement;
  const nextBtn = container.querySelector('#auditNext') as HTMLButtonElement;
  const pageInfo = container.querySelector('#auditPageInfo') as HTMLSpanElement;

  let allLogs: AttendanceAuditRow[] = [];
  let currentPage = 1;
  const PAGE_SIZE = 20;

  function renderPage() {
    if (allLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No attendance records found.</td></tr>';
      if (pageInfo) pageInfo.textContent = 'Page 1 of 1';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allLogs.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageSlice = allLogs.slice(startIdx, startIdx + PAGE_SIZE);

    tbody.innerHTML = pageSlice.map((l) => {
      const empName = l.employee_name || l.full_name || 'Employee';
      const isUnclosed = !l.clock_out_at && l.clock_in_at && l.status !== 'present';
      const isLate = l.is_late || l.status === 'late';
      
      let badgeClass = 'badge-purple';
      let statusText = l.status;
      if (l.status === 'present') {
        badgeClass = 'badge-success';
      } else if (isUnclosed) {
        badgeClass = 'badge-warning';
        statusText = 'Logged in';
      } else if (isLate) {
        badgeClass = 'badge-warning';
        statusText = `${l.status} (Late)`;
      }

      return `
        <tr>
          <td><strong>${empName}</strong></td>
          <td>${l.work_date}</td>
          <td>${formatESTTime(l.clock_in_at)}</td>
          <td>${formatESTTime(l.clock_out_at)}</td>
          <td>${l.hours_worked ?? '-'}</td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');

    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

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
      allLogs = await apiFetch<AttendanceAuditRow[]>(`/attendance${queryString}`);
      currentPage = 1;
      renderPage();
    } catch {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--accent-red);">Failed to load audit records.</td></tr>';
    }
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      const totalPages = Math.ceil(allLogs.length / PAGE_SIZE);
      if (currentPage < totalPages) {
        currentPage++;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
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
