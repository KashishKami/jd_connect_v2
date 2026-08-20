import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';

interface BreakAuditRow {
  id: string;
  employee_id: string;
  employee_name?: string;
  full_name?: string;
  alias?: string;
  break_type_name?: string;
  break_name?: string;
  start_at: string;
  end_at?: string;
  duration_minutes?: number;
  status: string;
}

interface BreakTypeItem {
  id: string;
  key: string;
  name: string;
}

export function renderBreaksAuditPage(container: HTMLElement): void {
  if (!guardRoute('portal.breaks_audit', container)) {
    return;
  }

  container.innerHTML = `
    <div class="main-content">
      <div class="section-header">
        <h2>Breaks Audit & Overbreak Monitor</h2>
      </div>

      <div class="filter-bar">
        <input type="text" id="breakSearch" class="input-search" placeholder="Filter by employee name..." />
        <select id="breakTypeFilter" class="select-filter">
          <option value="">All Break Types</option>
        </select>
        <select id="breakStatusFilter" class="select-filter">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="exceeded">Duration Exceeded</option>
        </select>
      </div>

      <div class="table-container">
        <table id="breakAuditTable" class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Break Type</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Duration (mins)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="breaksAuditTableBody">
            <tr><td colspan="6" style="text-align:center;">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-bar">
        <button id="breakAuditPrev" class="btn btn-secondary" disabled>Previous</button>
        <span id="breakAuditPageInfo" class="page-indicator">Page 1</span>
        <button id="breakAuditNext" class="btn btn-secondary" disabled>Next</button>
      </div>
    </div>
  `;

  initBreaksAuditLogic(container);
}

function initBreaksAuditLogic(container: HTMLElement): void {
  const tbody = container.querySelector('#breaksAuditTableBody') as HTMLTableSectionElement;
  const searchInput = container.querySelector('#breakSearch') as HTMLInputElement;
  const typeSelect = container.querySelector('#breakTypeFilter') as HTMLSelectElement;
  const statusSelect = container.querySelector('#breakStatusFilter') as HTMLSelectElement;

  async function loadBreakTypes() {
    if (!typeSelect) return;
    try {
      const types = await apiFetch<BreakTypeItem[]>('/break-types');
      types.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.key;
        opt.textContent = t.name;
        typeSelect.appendChild(opt);
      });
    } catch {
      // ignore
    }
  }

  async function loadBreakAuditLogs() {
    try {
      const params = new URLSearchParams();
      if (searchInput?.value.trim()) params.set('search', searchInput.value.trim());
      if (typeSelect?.value) params.set('break_type_key', typeSelect.value);
      if (statusSelect?.value) params.set('status', statusSelect.value);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const logs = await apiFetch<BreakAuditRow[]>(`/breaks${queryString}`);

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No break records found.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map((l) => {
        const empName = l.employee_name || l.full_name || 'Employee';
        const breakName = l.break_type_name || l.break_name || 'Break';
        const badgeClass = l.status === 'exceeded' ? 'badge-danger' : (l.status === 'active' ? 'badge-warning' : 'badge-success');

        return `
          <tr>
            <td><strong>${empName}</strong></td>
            <td>${breakName}</td>
            <td>${l.start_at ? new Date(l.start_at).toLocaleTimeString() : '-'}</td>
            <td>${l.end_at ? new Date(l.end_at).toLocaleTimeString() : '-'}</td>
            <td>${l.duration_minutes ?? '-'}</td>
            <td><span class="badge ${badgeClass}">${l.status}</span></td>
          </tr>
        `;
      }).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--accent-red);">Failed to load break audit logs.</td></tr>';
    }
  }

  if (searchInput) searchInput.oninput = () => loadBreakAuditLogs();
  if (typeSelect) typeSelect.onchange = () => loadBreakAuditLogs();
  if (statusSelect) statusSelect.onchange = () => loadBreakAuditLogs();

  loadBreakTypes();
  loadBreakAuditLogs();
}
