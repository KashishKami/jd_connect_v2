import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';
import { createModal } from '../components/modal';
import { formatESTTime } from '../lib/format';

function generateDigitReelHtml(id: string, isBreak = false): string {
  const breakClass = isBreak ? ' break-number' : '';
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-'].map((d) => `<span>${d}</span>`).join('');
  return `<div class="digit-window"><div class="digit-reel${breakClass}" id="${id}">${digits}</div></div>`;
}

function generateTimerReelsHtml(prefix: string, isBreak = false): string {
  return `
    <div class="sliding-digit-group">
      ${generateDigitReelHtml(`${prefix}H1`, isBreak)}
      ${generateDigitReelHtml(`${prefix}H2`, isBreak)}
    </div>
    <span class="timer-colon">:</span>
    <div class="sliding-digit-group">
      ${generateDigitReelHtml(`${prefix}M1`, isBreak)}
      ${generateDigitReelHtml(`${prefix}M2`, isBreak)}
    </div>
    <span class="timer-colon">:</span>
    <div class="sliding-digit-group">
      ${generateDigitReelHtml(`${prefix}S1`, isBreak)}
      ${generateDigitReelHtml(`${prefix}S2`, isBreak)}
    </div>
  `;
}

export function renderAttendanceConsole(container: HTMLElement): void {
  if (!guardRoute('portal.attendance', container)) {
    return;
  }

  const isEmbedded = !!container.closest('.main-content');
  const wrapperClass = isEmbedded ? 'embedded-console' : 'main-content';
  const headerHtml = isEmbedded ? '' : `
    <div class="section-header">
      <h2>Attendance Console</h2>
      <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">ℹ️ All dates and times are displayed in EST (Eastern Standard Time)</span>
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
              ${generateTimerReelsHtml('shift', false)}
            </div>
          </div>

          <div style="width: 75%; height: 1px; background: var(--border-color); opacity: 0.5;"></div>

          <div class="timer-section">
            <div class="timer-label">Break Duration</div>
            <div id="breakTimer" class="timer-display font-mono">
              ${generateTimerReelsHtml('break', true)}
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
          <div class="pagination-bar" style="margin-top: 0.75rem;">
            <button id="attPrev" class="btn btn-secondary" disabled>Previous</button>
            <span id="attPageInfo" class="page-indicator">Page 1</span>
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
          <div class="pagination-bar" style="margin-top: 0.75rem;">
            <button id="breakPrev" class="btn btn-secondary" disabled>Previous</button>
            <span id="breakPageInfo" class="page-indicator">Page 1</span>
            <button id="breakNext" class="btn btn-secondary" disabled>Next</button>
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

  const shiftH1 = container.querySelector('#shiftH1') as HTMLElement;
  const shiftH2 = container.querySelector('#shiftH2') as HTMLElement;
  const shiftM1 = container.querySelector('#shiftM1') as HTMLElement;
  const shiftM2 = container.querySelector('#shiftM2') as HTMLElement;
  const shiftS1 = container.querySelector('#shiftS1') as HTMLElement;
  const shiftS2 = container.querySelector('#shiftS2') as HTMLElement;

  const breakH1 = container.querySelector('#breakH1') as HTMLElement;
  const breakH2 = container.querySelector('#breakH2') as HTMLElement;
  const breakM1 = container.querySelector('#breakM1') as HTMLElement;
  const breakM2 = container.querySelector('#breakM2') as HTMLElement;
  const breakS1 = container.querySelector('#breakS1') as HTMLElement;
  const breakS2 = container.querySelector('#breakS2') as HTMLElement;

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

  function setReelDigit(el: HTMLElement | null, char: string) {
    if (!el) return;
    const idx = char >= '0' && char <= '9' ? parseInt(char, 10) : 10;
    el.style.transform = `translateY(-${idx * 1.5}rem)`;
  }

  function updateSlidingTimer(
    h1: HTMLElement | null, h2: HTMLElement | null,
    m1: HTMLElement | null, m2: HTMLElement | null,
    s1: HTMLElement | null, s2: HTMLElement | null,
    seconds: number | null
  ) {
    if (seconds === null || seconds < 0) {
      setReelDigit(h1, '-');
      setReelDigit(h2, '-');
      setReelDigit(m1, '-');
      setReelDigit(m2, '-');
      setReelDigit(s1, '-');
      setReelDigit(s2, '-');
      return;
    }
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hStr = String(hrs).padStart(2, '0');
    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');

    setReelDigit(h1, hStr[0]);
    setReelDigit(h2, hStr[1]);
    setReelDigit(m1, mStr[0]);
    setReelDigit(m2, mStr[1]);
    setReelDigit(s1, sStr[0]);
    setReelDigit(s2, sStr[1]);
  }

  function startLiveTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const now = Date.now();
      if (shiftStartTime) {
        const elapsedSecs = (now - shiftStartTime) / 1000;
        updateSlidingTimer(shiftH1, shiftH2, shiftM1, shiftM2, shiftS1, shiftS2, elapsedSecs);
      } else {
        updateSlidingTimer(shiftH1, shiftH2, shiftM1, shiftM2, shiftS1, shiftS2, null);
      }

      if (breakStartTime) {
        const elapsedSecs = (now - breakStartTime) / 1000;
        updateSlidingTimer(breakH1, breakH2, breakM1, breakM2, breakS1, breakS2, elapsedSecs);
      } else {
        updateSlidingTimer(breakH1, breakH2, breakM1, breakM2, breakS1, breakS2, null);
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
        updateSlidingTimer(shiftH1, shiftH2, shiftM1, shiftM2, shiftS1, shiftS2, null);
        updateSlidingTimer(breakH1, breakH2, breakM1, breakM2, breakS1, breakS2, null);
      } else if (statusData.status === 'clocked_in') {
        shiftStatusEl.textContent = 'Status: Clocked In';
        clockBtn.textContent = 'Clock Out';
        clockBtn.className = 'btn btn-danger';
        breakBtn.disabled = false;
        breakBtn.textContent = 'Start Break';
        updateSlidingTimer(breakH1, breakH2, breakM1, breakM2, breakS1, breakS2, null);
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

  const attPrevBtn = container.querySelector('#attPrev') as HTMLButtonElement;
  const attNextBtn = container.querySelector('#attNext') as HTMLButtonElement;
  const attPageInfo = container.querySelector('#attPageInfo') as HTMLSpanElement;

  const breakPrevBtn = container.querySelector('#breakPrev') as HTMLButtonElement;
  const breakNextBtn = container.querySelector('#breakNext') as HTMLButtonElement;
  const breakPageInfo = container.querySelector('#breakPageInfo') as HTMLSpanElement;

  let allAttLogs: Array<{ work_date: string; clock_in_at: string; clock_out_at?: string; hours_worked?: number; status: string }> = [];
  let attCurrentPage = 1;
  const ATT_PAGE_SIZE = 10;

  let allBreakLogs: Array<{ break_type_name?: string; break_name?: string; start_at: string; end_at?: string; duration_minutes?: number; status: string }> = [];
  let breakCurrentPage = 1;
  const BREAK_PAGE_SIZE = 10;

  function renderAttPage() {
    const tbody = container.querySelector('#attTableBody') as HTMLTableSectionElement;
    if (!tbody) return;
    if (allAttLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found.</td></tr>';
      if (attPageInfo) attPageInfo.textContent = 'Page 1 of 1';
      if (attPrevBtn) attPrevBtn.disabled = true;
      if (attNextBtn) attNextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allAttLogs.length / ATT_PAGE_SIZE) || 1;
    if (attCurrentPage > totalPages) attCurrentPage = totalPages;
    if (attCurrentPage < 1) attCurrentPage = 1;

    const startIdx = (attCurrentPage - 1) * ATT_PAGE_SIZE;
    const pageSlice = allAttLogs.slice(startIdx, startIdx + ATT_PAGE_SIZE);

    tbody.innerHTML = pageSlice.map((l) => {
      const isUnclosed = !l.clock_out_at && l.clock_in_at && l.status !== 'present';
      let badgeClass = 'badge-purple';
      let statusText = l.status;
      if (l.status === 'present') {
        badgeClass = 'badge-success';
      } else if (isUnclosed) {
        badgeClass = 'badge-warning';
        statusText = 'Logged in';
      }

      return `
        <tr>
          <td>${l.work_date}</td>
          <td>${formatESTTime(l.clock_in_at)}</td>
          <td>${formatESTTime(l.clock_out_at)}</td>
          <td>${l.hours_worked ?? '-'}</td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');

    if (attPageInfo) attPageInfo.textContent = `Page ${attCurrentPage} of ${totalPages}`;
    if (attPrevBtn) attPrevBtn.disabled = attCurrentPage <= 1;
    if (attNextBtn) attNextBtn.disabled = attCurrentPage >= totalPages;
  }

  function renderBreakPage() {
    const tbody = container.querySelector('#breakTableBody') as HTMLTableSectionElement;
    if (!tbody) return;
    if (allBreakLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found.</td></tr>';
      if (breakPageInfo) breakPageInfo.textContent = 'Page 1 of 1';
      if (breakPrevBtn) breakPrevBtn.disabled = true;
      if (breakNextBtn) breakNextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allBreakLogs.length / BREAK_PAGE_SIZE) || 1;
    if (breakCurrentPage > totalPages) breakCurrentPage = totalPages;
    if (breakCurrentPage < 1) breakCurrentPage = 1;

    const startIdx = (breakCurrentPage - 1) * BREAK_PAGE_SIZE;
    const pageSlice = allBreakLogs.slice(startIdx, startIdx + BREAK_PAGE_SIZE);

    tbody.innerHTML = pageSlice.map((l) => `
      <tr>
        <td>${l.break_type_name || l.break_name || 'Break'}</td>
        <td>${formatESTTime(l.start_at)}</td>
        <td>${formatESTTime(l.end_at)}</td>
        <td>${l.duration_minutes ?? '-'}</td>
        <td><span class="badge ${l.status === 'exceeded' ? 'badge-danger' : 'badge-success'}">${l.status}</span></td>
      </tr>
    `).join('');

    if (breakPageInfo) breakPageInfo.textContent = `Page ${breakCurrentPage} of ${totalPages}`;
    if (breakPrevBtn) breakPrevBtn.disabled = breakCurrentPage <= 1;
    if (breakNextBtn) breakNextBtn.disabled = breakCurrentPage >= totalPages;
  }

  async function loadAttendanceLogs() {
    const tbody = container.querySelector('#attTableBody') as HTMLTableSectionElement;
    try {
      allAttLogs = await apiFetch<Array<{ work_date: string; clock_in_at: string; clock_out_at?: string; hours_worked?: number; status: string }>>('/attendance?employee_id=me');
      attCurrentPage = 1;
      renderAttPage();
    } catch {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--accent-red);">Failed to load history.</td></tr>';
    }
  }

  async function loadBreakLogs() {
    const tbody = container.querySelector('#breakTableBody') as HTMLTableSectionElement;
    try {
      allBreakLogs = await apiFetch<Array<{ break_type_name?: string; break_name?: string; start_at: string; end_at?: string; duration_minutes?: number; status: string }>>('/breaks?employee_id=me');
      breakCurrentPage = 1;
      renderBreakPage();
    } catch {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--accent-red);">Failed to load break logs.</td></tr>';
    }
  }

  if (attPrevBtn) {
    attPrevBtn.onclick = () => {
      if (attCurrentPage > 1) {
        attCurrentPage--;
        renderAttPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  if (attNextBtn) {
    attNextBtn.onclick = () => {
      const totalPages = Math.ceil(allAttLogs.length / ATT_PAGE_SIZE);
      if (attCurrentPage < totalPages) {
        attCurrentPage++;
        renderAttPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  if (breakPrevBtn) {
    breakPrevBtn.onclick = () => {
      if (breakCurrentPage > 1) {
        breakCurrentPage--;
        renderBreakPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  if (breakNextBtn) {
    breakNextBtn.onclick = () => {
      const totalPages = Math.ceil(allBreakLogs.length / BREAK_PAGE_SIZE);
      if (breakCurrentPage < totalPages) {
        breakCurrentPage++;
        renderBreakPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  loadStatus();
  loadBreakTypes();
  loadAttendanceLogs();
  loadBreakLogs();
}
