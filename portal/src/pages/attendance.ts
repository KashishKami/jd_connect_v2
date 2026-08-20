import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';

export function renderAttendanceConsole(container: HTMLElement): void {
  if (!guardRoute('portal.attendance', container)) {
    return;
  }

  container.innerHTML = `
    <div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
      <h1 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--primary);">Attendance Console</h1>
      
      <!-- Status Card -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="modal-content" style="max-width: 100%;">
          <h3 style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.5rem;">Shift Action</h3>
          <div id="shiftStatus" style="font-size: 1.3rem; font-weight: 600; margin-bottom: 1rem;">Status: Loading...</div>
          <div id="shiftTimer" style="font-size: 1rem; color: var(--primary); margin-bottom: 1rem;">--:--:--</div>
          <button id="clockBtn" class="btn btn-primary" style="width: 100%;">Clock In</button>
        </div>

        <div class="modal-content" style="max-width: 100%;">
          <h3 style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.5rem;">Break Action</h3>
          <div style="margin-bottom: 1rem;">
            <select id="breakTypeSelect" style="width: 100%; padding: 0.6rem; border-radius: var(--radius); border: 1px solid var(--border-color); background: var(--bg-dark); color: var(--text-main);">
              <option value="">Select Break Type...</option>
            </select>
          </div>
          <div id="breakTimer" style="font-size: 1rem; color: var(--warning); margin-bottom: 1rem;">--:--:--</div>
          <button id="breakBtn" class="btn btn-secondary" style="width: 100%;" disabled>Start Break</button>
        </div>
      </div>

      <!-- History Tabs -->
      <div class="modal-content" style="max-width: 100%;">
        <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <button id="tabAtt" class="btn btn-primary">Attendance Logs</button>
          <button id="tabBreak" class="btn btn-secondary">Break Logs</button>
        </div>

        <div id="tabAttContent">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Work Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Hours Worked</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="attTableBody">
                <tr><td colspan="5" style="text-align:center;">Loading...</td></tr>
              </tbody>
            </table>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <button id="attPrev" class="btn btn-secondary" disabled>Previous</button>
            <span id="attPageInfo" style="color: var(--text-muted); font-size: 0.9rem;">Page 1</span>
            <button id="attNext" class="btn btn-secondary" disabled>Next</button>
          </div>
        </div>

        <div id="tabBreakContent" style="display: none;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Break Type</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Duration (mins)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="breakTableBody">
                <tr><td colspan="5" style="text-align:center;">Loading...</td></tr>
              </tbody>
            </table>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <button id="breakPrev" class="btn btn-secondary" disabled>Previous</button>
            <span id="breakPageInfo" style="color: var(--text-muted); font-size: 0.9rem;">Page 1</span>
            <button id="breakNext" class="btn btn-secondary" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers and data loaders
  initAttendanceLogic(container);
}

function initAttendanceLogic(container: HTMLElement): void {
  const clockBtn = container.querySelector('#clockBtn') as HTMLButtonElement;
  const breakBtn = container.querySelector('#breakBtn') as HTMLButtonElement;
  const breakTypeSelect = container.querySelector('#breakTypeSelect') as HTMLSelectElement;
  const shiftStatusEl = container.querySelector('#shiftStatus') as HTMLDivElement;

  const tabAtt = container.querySelector('#tabAtt') as HTMLButtonElement;
  const tabBreak = container.querySelector('#tabBreak') as HTMLButtonElement;
  const tabAttContent = container.querySelector('#tabAttContent') as HTMLDivElement;
  const tabBreakContent = container.querySelector('#tabBreakContent') as HTMLDivElement;

  let isClockedIn = false;
  let isOnBreak = false;

  tabAtt.onclick = () => {
    tabAtt.className = 'btn btn-primary';
    tabBreak.className = 'btn btn-secondary';
    tabAttContent.style.display = 'block';
    tabBreakContent.style.display = 'none';
  };

  tabBreak.onclick = () => {
    tabBreak.className = 'btn btn-primary';
    tabAtt.className = 'btn btn-secondary';
    tabBreakContent.style.display = 'block';
    tabAttContent.style.display = 'none';
  };

  // Load Status & Break Types
  async function loadStatus() {
    try {
      const statusData = await apiFetch<{ status: 'off_shift' | 'clocked_in' | 'on_break' }>('/attendance/status');
      isClockedIn = statusData.status === 'clocked_in' || statusData.status === 'on_break';
      isOnBreak = statusData.status === 'on_break';

      if (statusData.status === 'off_shift') {
        shiftStatusEl.textContent = 'Status: Off Shift';
        clockBtn.textContent = 'Clock In';
        clockBtn.className = 'btn btn-primary';
        breakBtn.disabled = true;
      } else if (statusData.status === 'clocked_in') {
        shiftStatusEl.textContent = 'Status: Clocked In';
        clockBtn.textContent = 'Clock Out';
        clockBtn.className = 'btn btn-danger';
        breakBtn.disabled = false;
        breakBtn.textContent = 'Start Break';
      } else if (statusData.status === 'on_break') {
        shiftStatusEl.textContent = 'Status: On Break';
        clockBtn.textContent = 'Clock Out';
        clockBtn.className = 'btn btn-danger';
        breakBtn.disabled = false;
        breakBtn.textContent = 'End Break';
        breakBtn.className = 'btn btn-primary';
      }
    } catch {
      shiftStatusEl.textContent = 'Status: Error loading status';
    }
  }

  async function loadBreakTypes() {
    try {
      const types = await apiFetch<Array<{ id: string; name: string }>>('/breaks/types');
      types.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        breakTypeSelect.appendChild(opt);
      });
    } catch {
      // ignore
    }
  }

  clockBtn.onclick = async () => {
    try {
      if (!isClockedIn) {
        await apiFetch('/attendance/clock-in', { method: 'POST' });
        showToast('Clocked in successfully', 'success');
      } else {
        await apiFetch('/attendance/clock-out', { method: 'POST' });
        showToast('Clocked out successfully', 'success');
      }
      await loadStatus();
      await loadAttendanceLogs();
    } catch (err) {
      showToast((err as Error).message, 'danger');
    }
  };

  breakBtn.onclick = async () => {
    try {
      if (!isOnBreak) {
        const typeId = breakTypeSelect.value;
        if (!typeId) {
          showToast('Please select a break type', 'danger');
          return;
        }
        await apiFetch('/breaks/start', { method: 'POST', body: JSON.stringify({ break_type_id: typeId }) });
        showToast('Break started', 'success');
      } else {
        await apiFetch('/breaks/end', { method: 'POST' });
        showToast('Break ended', 'success');
      }
      await loadStatus();
      await loadBreakLogs();
    } catch (err) {
      showToast((err as Error).message, 'danger');
    }
  };

  async function loadAttendanceLogs() {
    const tbody = container.querySelector('#attTableBody') as HTMLTableSectionElement;
    try {
      const logs = await apiFetch<Array<{ work_date: string; clock_in_at: string; clock_out_at?: string; hours_worked?: number; status: string }>>('/attendance/history?employee_id=me');
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found.</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td>${l.work_date}</td>
          <td>${l.clock_in_at ? new Date(l.clock_in_at).toLocaleTimeString() : '-'}</td>
          <td>${l.clock_out_at ? new Date(l.clock_out_at).toLocaleTimeString() : '-'}</td>
          <td>${l.hours_worked ?? '-'}</td>
          <td>${l.status}</td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Failed to load history.</td></tr>';
    }
  }

  async function loadBreakLogs() {
    const tbody = container.querySelector('#breakTableBody') as HTMLTableSectionElement;
    try {
      const logs = await apiFetch<Array<{ break_name?: string; start_at: string; end_at?: string; duration_minutes?: number; status: string }>>('/breaks/history?employee_id=me');
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found.</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td>${l.break_name || 'Break'}</td>
          <td>${l.start_at ? new Date(l.start_at).toLocaleTimeString() : '-'}</td>
          <td>${l.end_at ? new Date(l.end_at).toLocaleTimeString() : '-'}</td>
          <td>${l.duration_minutes ?? '-'}</td>
          <td>${l.status}</td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Failed to load break logs.</td></tr>';
    }
  }

  loadStatus();
  loadBreakTypes();
  loadAttendanceLogs();
  loadBreakLogs();
}
