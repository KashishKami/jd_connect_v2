import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';

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

  async function loadBreakAuditLogs() {
    try {
      const logs = await apiFetch<Array<{
        first_name?: string;
        last_name?: string;
        break_name?: string;
        start_at: string;
        end_at?: string;
        duration_minutes?: number;
        status: string;
      }>>('/breaks/audit');

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No break records found.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td><strong>${l.first_name || 'Employee'} ${l.last_name || ''}</strong></td>
          <td>${l.break_name || 'Break'}</td>
          <td>${l.start_at ? new Date(l.start_at).toLocaleTimeString() : '-'}</td>
          <td>${l.end_at ? new Date(l.end_at).toLocaleTimeString() : '-'}</td>
          <td>${l.duration_minutes ?? '-'}</td>
          <td><span class="badge ${l.status === 'exceeded' ? 'badge-danger' : 'badge-success'}">${l.status}</span></td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--accent-red);">Failed to load break audit logs.</td></tr>';
    }
  }

  if (searchInput) searchInput.oninput = () => loadBreakAuditLogs();

  loadBreakAuditLogs();
}
