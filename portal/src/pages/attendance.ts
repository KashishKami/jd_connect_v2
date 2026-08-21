import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';
import { createModal } from '../components/modal';

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
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Card 1: Shift Action -->
        <div class="console-card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.75rem;">Shift Action</h3>
            <div id="shiftStatus" style="font-size: 1.3rem; font-weight: 600; margin-bottom: 1.25rem;">Status: Loading...</div>
          </div>
          <button id="clockBtn" class="btn btn-primary" style="width: 100%;">Clock In</button>
        </div>

        <!-- Card 2: Active Timers (Middle Card) -->
        <div class="console-card timer-card">
          <div class="timer-section">
            <div class="timer-label">Shift Duration</div>
            <div id="shiftTimer" class="timer-display font-mono">
              <span class="sliding-number" id="shiftHours">00</span>
              <span class="timer-colon">:</span>
              <span class="sliding-number" id="shiftMins">00</span>
              <span class="timer-colon">:</span>
              <span class="sliding-number" id="shiftSecs">00</span>
            </div>
          </div>

          <div style="width: 75%; height: 1px; background: var(--border-color); opacity: 0.5;"></div>

          <div class="timer-section">
            <div class="timer-label">Break Duration</div>
            <div id="breakTimer" class="timer-display font-mono">
              <span class="sliding-number break-number" id="breakHours">00</span>
              <span class="timer-colon">:</span>
              <span class="sliding-number break-number" id="breakMins">00</span>
              <span class="timer-colon">:</span>
              <span class="sliding-number break-number" id="breakSecs">00</span>
            </div>
          </div>
        </div>

        <!-- Card 3: Break Action -->
        <div class="console-card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.75rem;">Break Action</h3>
            <div style="margin-bottom: 1.25rem;">
              <select id="breakTypeSelect" class="select-filter" style="width: 100%;">
                <option value="">Select Break Type...</option>
              </select>
            </div>
          </div>
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

function confirmClockOutModal(onConfirm: () => Promise<void>): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <p style="font-size: 1rem; color: var(--text-main); margin-bottom: 0.75rem;">
        Are you sure you want to clock out for today?
      </p>
      <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--accent-red); padding: 0.85rem 1rem; border-radius: 8px; font-size: 0.875rem; color: var(--accent-red); font-weight: 500;">
        ⚠️ <strong>Important:</strong> Once you clock out, you cannot clock in again for the rest of the day!
      </div>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
      <button id="cancelClockOutBtn" class="btn btn-secondary">Cancel</button>
      <button id="confirmClockOutBtn" class="btn btn-danger">Confirm Clock Out</button>
    </div>
  `;

  const overlay = createModal({
    title: 'Confirm Clock Out',
    content,
  });

  const cancelBtn = content.querySelector('#cancelClockOutBtn') as HTMLButtonElement;
  const confirmBtn = content.querySelector('#confirmClockOutBtn') as HTMLButtonElement;

  cancelBtn.onclick = () => {
    overlay.remove();
  };

  confirmBtn.onclick = async () => {
    overlay.remove();
    await onConfirm();
  };
}

function initAttendanceLogic(container: HTMLElement): void {
  const clockBtn = container.querySelector('#clockBtn') as HTMLButtonElement;
  const breakBtn = container.querySelector('#breakBtn') as HTMLButtonElement;
  const breakTypeSelect = container.querySelector('#breakTypeSelect') as HTMLSelectElement;
  const shiftStatusEl = container.querySelector('#shiftStatus') as HTMLDivElement;

  const shiftHoursEl = container.querySelector('#shiftHours') as HTMLSpanElement;
  const shiftMinsEl = container.querySelector('#shiftMins') as HTMLSpanElement;
  const shiftSecsEl = container.querySelector('#shiftSecs') as HTMLSpanElement;

  const breakHoursEl = container.querySelector('#breakHours') as HTMLSpanElement;
  const breakMinsEl = container.querySelector('#breakMins') as HTMLSpanElement;
  const breakSecsEl = container.querySelector('#breakSecs') as HTMLSpanElement;

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

  function updateTimerElements(hoursEl: HTMLElement, minsEl: HTMLElement, secsEl: HTMLElement, seconds: number | null) {
    if (seconds === null || seconds < 0) {
      if (hoursEl.textContent !== '00') hoursEl.textContent = '00';
      if (minsEl.textContent !== '00') minsEl.textContent = '00';
      if (secsEl.textContent !== '00') secsEl.textContent = '00';
      return;
    }
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hStr = String(hrs).padStart(2, '0');
    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');

    if (hoursEl.textContent !== hStr) hoursEl.textContent = hStr;
    if (minsEl.textContent !== mStr) minsEl.textContent = mStr;
    if (secsEl.textContent !== sStr) secsEl.textContent = sStr;
  }

  function startLiveTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const now = Date.now();
      if (shiftStartTime) {
        const elapsedSecs = (now - shiftStartTime) / 1000;
        updateTimerElements(shiftHoursEl, shiftMinsEl, shiftSecsEl, elapsedSecs);
      } else {
        updateTimerElements(shiftHoursEl, shiftMinsEl, shiftSecsEl, null);
      }

      if (breakStartTime) {
        const elapsedSecs = (now - breakStartTime) / 1000;
        updateTimerElements(breakHoursEl, breakMinsEl, breakSecsEl, elapsedSecs);
      } else {
        updateTimerElements(breakHoursEl, breakMinsEl, breakSecsEl, null);
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
        updateTimerElements(shiftHoursEl, shiftMinsEl, shiftSecsEl, null);
        updateTimerElements(breakHoursEl, breakMinsEl, breakSecsEl, null);
      } else if (statusData.status === 'clocked_in') {
        shiftStatusEl.textContent = 'Status: Clocked In';
        clockBtn.textContent = 'Clock Out';
        clockBtn.className = 'btn btn-danger';
        breakBtn.disabled = false;
        breakBtn.textContent = 'Start Break';
        updateTimerElements(breakHoursEl, breakMinsEl, breakSecsEl, null);
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
    if (!isClockedIn) {
      try {
        await apiFetch('/attendance/clock-in', { method: 'POST' });
        showToast('Clocked in successfully', 'success');
        await loadStatus();
        await loadAttendanceLogs();
      } catch (err) {
        showToast((err as Error).message, 'danger');
      }
    } else {
      confirmClockOutModal(async () => {
        try {
          await apiFetch('/attendance/clock-out', { method: 'POST' });
          showToast('Clocked out successfully', 'success');
          await loadStatus();
          await loadAttendanceLogs();
        } catch (err) {
          showToast((err as Error).message, 'danger');
        }
      });
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
