import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';

export function renderAttendanceConsole(container: HTMLElement): void {
  if (!guardRoute('portal.attendance', container)) {
    return;
  }

  const isEmbedded = !!container.closest('.main-content');
  const wrapperClass = isEmbedded ? 'embedded-console' : 'main-content';
  const headerHtml = isEmbedded ? '' : `
    <div class="section-header">
      <h2>Attendance Console</h2>
    </div>
  `;

  container.innerHTML = `
    <div class="${wrapperClass}">
      ${headerHtml}
      
      <!-- Status Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="console-card">
          <h3 style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.5rem;">Shift Action</h3>
          <div id="shiftStatus" style="font-size: 1.3rem; font-weight: 600; margin-bottom: 0.5rem;">Status: Loading...</div>
          <div id="shiftTimer" style="font-size: 1.1rem; font-weight: 700; color: var(--accent-indigo); margin-bottom: 1rem; font-family: monospace;">--:--:--</div>
          <button id="clockBtn" class="btn btn-primary" style="width: 100%;">Clock In</button>
        </div>

        <div class="console-card">
          <h3 style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.5rem;">Break Action</h3>
          <div style="margin-bottom: 0.75rem;">
            <select id="breakTypeSelect" class="select-filter" style="width: 100%;">
              <option value="">Select Break Type...</option>
            </select>
          </div>
          <div id="breakTimer" style="font-size: 1.1rem; font-weight: 700; color: var(--accent-amber); margin-bottom: 1rem; font-family: monospace;">--:--:--</div>
          <button id="breakBtn" class="btn btn-secondary" style="width: 100%;" disabled>Start Break</button>
        </div>
      </div>

      <!-- History Tabs -->
      <div class="console-card">
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
        </div>
      </div>
    </div>
  `;

  initAttendanceLogic(container);
}

function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

function initAttendanceLogic(container: HTMLElement): void {
  const clockBtn = container.querySelector('#clockBtn') as HTMLButtonElement;
  const breakBtn = container.querySelector('#breakBtn') as HTMLButtonElement;
  const breakTypeSelect = container.querySelector('#breakTypeSelect') as HTMLSelectElement;
  const shiftStatusEl = container.querySelector('#shiftStatus') as HTMLDivElement;
  const shiftTimerEl = container.querySelector('#shiftTimer') as HTMLDivElement;
  const breakTimerEl = container.querySelector('#breakTimer') as HTMLDivElement;

  const tabAtt = container.querySelector('#tabAtt') as HTMLButtonElement;
  const tabBreak = container.querySelector('#tabBreak') as HTMLButtonElement;
  const tabAttContent = container.querySelector('#tabAttContent') as HTMLDivElement;
  const tabBreakContent = container.querySelector('#tabBreakContent') as HTMLDivElement;

  let isClockedIn = false;
  let isOnBreak = false;
  let shiftStartTime: number | null = null;
  let breakStartTime: number | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

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

  function startLiveTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const now = Date.now();
      if (shiftStartTime) {
        const elapsedSecs = (now - shiftStartTime) / 1000;
        shiftTimerEl.textContent = formatDuration(elapsedSecs);
      } else {
        shiftTimerEl.textContent = '--:--:--';
      }

      if (breakStartTime) {
        const elapsedSecs = (now - breakStartTime) / 1000;
        breakTimerEl.textContent = formatDuration(elapsedSecs);
      } else {
        breakTimerEl.textContent = '--:--:--';
      }
    }, 1000);
  }

  // Load Status & Break Types
  async function loadStatus() {
    try {
      const statusData = await apiFetch<{
        status: 'off_shift' | 'clocked_in' | 'on_break';
        clock_in_at?: string;
        break_start_at?: string;
      }>('/attendance/status');

      isClockedIn = statusData.status === 'clocked_in' || statusData.status === 'on_break';
      isOnBreak = statusData.status === 'on_break';
      shiftStartTime = statusData.clock_in_at ? new Date(statusData.clock_in_at).getTime() : null;
      breakStartTime = statusData.break_start_at ? new Date(statusData.break_start_at).getTime() : null;

      if (statusData.status === 'off_shift') {
        shiftStatusEl.textContent = 'Status: Off Shift';
        clockBtn.textContent = 'Clock In';
        clockBtn.className = 'btn btn-primary';
        breakBtn.disabled = true;
        shiftTimerEl.textContent = '--:--:--';
        breakTimerEl.textContent = '--:--:--';
      } else if (statusData.status === 'clocked_in') {
        shiftStatusEl.textContent = 'Status: Clocked In';
        clockBtn.textContent = 'Clock Out';
        clockBtn.className = 'btn btn-danger';
        breakBtn.disabled = false;
        breakBtn.textContent = 'Start Break';
        breakTimerEl.textContent = '--:--:--';
      } else if (statusData.status === 'on_break') {
        shiftStatusEl.textContent = 'Status: On Break';
        clockBtn.textContent = 'Clock Out';
        clockBtn.className = 'btn btn-danger';
        breakBtn.disabled = false;
        breakBtn.textContent = 'End Break';
        breakBtn.className = 'btn btn-primary';
      }

      startLiveTimer();
    } catch {
      shiftStatusEl.textContent = 'Status: Error loading status';
    }
  }

  async function loadBreakTypes() {
    try {
      const types = await apiFetch<Array<{ id: string; key: string; name: string }>>('/break-types');
      breakTypeSelect.innerHTML = '<option value="">Select Break Type...</option>';
      types.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.key;
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
        const typeKey = breakTypeSelect.value;
        if (!typeKey) {
          showToast('Please select a break type', 'danger');
          return;
        }
        await apiFetch('/breaks/start', { method: 'POST', body: JSON.stringify({ break_type_key: typeKey }) });
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
      const logs = await apiFetch<Array<{ work_date: string; clock_in_at: string; clock_out_at?: string; hours_worked?: number; status: string }>>('/attendance?employee_id=me');
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
          <td><span class="badge badge-purple">${l.status}</span></td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--accent-red);">Failed to load history.</td></tr>';
    }
  }

  async function loadBreakLogs() {
    const tbody = container.querySelector('#breakTableBody') as HTMLTableSectionElement;
    try {
      const logs = await apiFetch<Array<{ break_type_name?: string; break_name?: string; start_at: string; end_at?: string; duration_minutes?: number; status: string }>>('/breaks?employee_id=me');
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found.</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td>${l.break_type_name || l.break_name || 'Break'}</td>
          <td>${l.start_at ? new Date(l.start_at).toLocaleTimeString() : '-'}</td>
          <td>${l.end_at ? new Date(l.end_at).toLocaleTimeString() : '-'}</td>
          <td>${l.duration_minutes ?? '-'}</td>
          <td><span class="badge ${l.status === 'exceeded' ? 'badge-danger' : 'badge-success'}">${l.status}</span></td>
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--accent-red);">Failed to load break logs.</td></tr>';
    }
  }

  loadStatus();
  loadBreakTypes();
  loadAttendanceLogs();
  loadBreakLogs();
}
