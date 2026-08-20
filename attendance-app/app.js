(function () {
  const BACKEND_URL = window.LOCATION_BACKEND_URL || 'http://localhost:4000';

  const loginView = document.getElementById('loginView');
  const attendanceView = document.getElementById('attendanceView');
  const userDetailsContainer = document.getElementById('userDetailsContainer');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const ssoBtn = document.getElementById('ssoBtn');
  const userNameLabel = document.getElementById('userNameLabel');
  const userEmailLabel = document.getElementById('userEmailLabel');
  const logoutBtn = document.getElementById('logoutBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Sub-tab history controls
  const subTabAttendanceBtn = document.getElementById('subTabAttendanceBtn');
  const subTabBreaksBtn = document.getElementById('subTabBreaksBtn');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const attendanceHistoryView = document.getElementById('attendanceHistoryView');
  const breakHistoryView = document.getElementById('breakHistoryView');
  const attendanceHistoryTableBody = document.getElementById('attendanceHistoryTableBody');
  const breakHistoryTableBody = document.getElementById('breakHistoryTableBody');

  // Attendance History Pagination (10 rows/page)
  const attHistPrevBtn = document.getElementById('attHistPrevBtn');
  const attHistNextBtn = document.getElementById('attHistNextBtn');
  const attHistPageInfo = document.getElementById('attHistPageInfo');
  let currentAttendancePage = 1;
  const ATTENDANCE_PAGE_SIZE = 10;
  let allAttendanceRecords = [];

  // Break History Pagination (10 rows/page)
  const brkHistPrevBtn = document.getElementById('brkHistPrevBtn');
  const brkHistNextBtn = document.getElementById('brkHistNextBtn');
  const brkHistPageInfo = document.getElementById('brkHistPageInfo');
  let currentBreakPage = 1;
  const BREAKS_PAGE_SIZE = 10;
  let allBreakRecords = [];

  // Shift & Break DOM elements
  const clockInContainer = document.getElementById('clockInContainer');
  const activeShiftControls = document.getElementById('activeShiftControls');
  const startBreakContainer = document.getElementById('startBreakContainer');
  const endBreakContainer = document.getElementById('endBreakContainer');
  const clockInBtn = document.getElementById('clockInBtn');
  const clockOutHeaderBtn = document.getElementById('clockOutHeaderBtn');
  const statusBadge = document.getElementById('statusBadge');
  const timerEl = document.getElementById('timer');
  const breakTimerSubtext = document.getElementById('breakTimerSubtext');
  const breakTimerEl = document.getElementById('breakTimer');
  const breakSelect = document.getElementById('breakSelect');
  const startBreakBtn = document.getElementById('startBreakBtn');
  const endBreakBtn = document.getElementById('endBreakBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Modal elements
  const clockOutModal = document.getElementById('clockOutModal');
  const cancelClockOutBtn = document.getElementById('cancelClockOutBtn');
  const confirmClockOutBtn = document.getElementById('confirmClockOutBtn');

  let token = localStorage.getItem('jdconnect_token');
  let activeClockInIso = null;
  let activeBreakStartIso = null;
  let shiftTimerInterval = null;
  let breakTimerInterval = null;

  // Theme Toggle (Default Notion Dark Theme)
  function initTheme() {
    const savedTheme = localStorage.getItem('jd_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
    } else {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    }
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-theme');
    if (isLight) {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('jd_theme', 'light');
      if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
    } else {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('jd_theme', 'dark');
      if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    }
  }

  initTheme();
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function formatSecondsToHHMMSS(totalSeconds) {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }

  function startShiftTimer(clockInIso) {
    if (clockInIso) activeClockInIso = clockInIso;
    if (!activeClockInIso) activeClockInIso = new Date().toISOString();

    if (shiftTimerInterval) clearInterval(shiftTimerInterval);

    const updateTimer = () => {
      const startTime = new Date(activeClockInIso).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      if (timerEl) timerEl.textContent = formatSecondsToHHMMSS(elapsed);
    };

    updateTimer();
    shiftTimerInterval = setInterval(updateTimer, 1000);
  }

  function stopShiftTimer() {
    if (shiftTimerInterval) clearInterval(shiftTimerInterval);
    if (timerEl) timerEl.textContent = '00:00:00';
  }

  function startBreakTimer(breakStartIso) {
    if (breakStartIso) activeBreakStartIso = breakStartIso;
    if (!activeBreakStartIso) activeBreakStartIso = new Date().toISOString();

    if (breakTimerSubtext) breakTimerSubtext.style.display = 'block';
    if (breakTimerInterval) clearInterval(breakTimerInterval);

    const updateTimer = () => {
      const startTime = new Date(activeBreakStartIso).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      if (breakTimerEl) breakTimerEl.textContent = formatSecondsToHHMMSS(elapsed);
    };

    updateTimer();
    breakTimerInterval = setInterval(updateTimer, 1000);
  }

  function stopBreakTimer() {
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    activeBreakStartIso = null;
    if (breakTimerSubtext) breakTimerSubtext.style.display = 'none';
  }

  async function apiRequest(endpoint, method = 'GET', body = null, skipAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (token && !skipAuth) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || `HTTP error ${res.status}`);
      err.status = res.status;
      if (data.error === 'Employee chat profile not linked' || res.status === 401) {
        localStorage.removeItem('jdconnect_token');
        token = null;
      }
      throw err;
    }
    return data;
  }

  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return '-';
    }
  }

  function formatDateFull(isoString) {
    if (!isoString) return '-';
    try {
      if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
        const [year, month, day] = isoString.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00/.test(isoString)) {
        const [year, month, day] = isoString.slice(0, 10).split('-').map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  }

  async function loadUserProfile() {
    if (!token) return;
    try {
      const userInfo = await apiRequest('/oauth/userinfo');
      if (userNameLabel) userNameLabel.textContent = userInfo.name || userInfo.email;
      if (userEmailLabel) userEmailLabel.textContent = userInfo.email;
    } catch {
      // Fallback
    }
  }

  async function handleLogin() {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      showToast('Please enter both email and password', 'error');
      return;
    }

    try {
      const res = await apiRequest('/api/auth/login', 'POST', { email, password }, true);
      token = res.access_token;
      localStorage.setItem('jdconnect_token', token);
      showToast('Login successful!', 'success');

      if (res.user) {
        if (userNameLabel) userNameLabel.textContent = res.user.full_name || res.user.email;
        if (userEmailLabel) userEmailLabel.textContent = res.user.email;
      }

      showAttendanceView();
      initAttendanceState();
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  }

  function handleSsoRedirect() {
    const redirectUri = window.location.origin + window.location.pathname;
    const authorizeUrl = `${BACKEND_URL}/oauth/authorize?client_id=attendance-app&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authorizeUrl;
  }

  function handleLogout() {
    token = null;
    localStorage.removeItem('jdconnect_token');
    showLoginView();
    showToast('Logged out successfully', 'info');
  }

  function showLoginView() {
    if (loginView) loginView.style.display = 'flex';
    if (attendanceView) attendanceView.style.display = 'none';
    if (userDetailsContainer) userDetailsContainer.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (clockOutHeaderBtn) clockOutHeaderBtn.style.display = 'none';
  }

  function showAttendanceView() {
    if (loginView) loginView.style.display = 'none';
    if (attendanceView) attendanceView.style.display = 'block';
    if (userDetailsContainer) userDetailsContainer.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'block';
    loadAttendanceHistory();
    loadBreakHistory();
  }

  async function loadBreakTypes() {
    try {
      const types = await apiRequest('/api/break-types');
      if (breakSelect && Array.isArray(types)) {
        breakSelect.innerHTML = '<option value="">Select Break Reason...</option>';
        types.forEach((t) => {
          const opt = document.createElement('option');
          opt.value = t.key;
          opt.textContent = `${t.name} (${t.default_limit_minutes ? t.default_limit_minutes + ' min' : 'Unlimited'})`;
          breakSelect.appendChild(opt);
        });
      }
    } catch {
      // Graceful fallback
    }
  }

  async function initAttendanceState() {
    try {
      await loadUserProfile();
      await loadBreakTypes();
      const status = await apiRequest('/api/attendance/status');
      if (status.status === 'clocked_in') {
        updateUiClockedIn(status.clock_in_at);
      } else if (status.status === 'on_break') {
        updateUiOnBreak(status.break_start_at, status.clock_in_at);
      } else {
        updateUiClockedOut();
      }
    } catch (err) {
      if (err.status === 401) {
        handleLogout();
      }
    }
  }

  // Attendance History Fetch & 10-row Pagination
  async function loadAttendanceHistory() {
    if (!attendanceHistoryTableBody) return;
    try {
      attendanceHistoryTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">Loading your attendance logs...</td></tr>';
      const records = await apiRequest('/api/attendance?employee_id=me');
      if (!Array.isArray(records) || records.length === 0) {
        allAttendanceRecords = [];
        renderAttendanceHistoryPage();
        return;
      }
      allAttendanceRecords = records;
      currentAttendancePage = 1;
      renderAttendanceHistoryPage();
    } catch (err) {
      attendanceHistoryTableBody.innerHTML = `<tr><td colspan="5" style="color: var(--accent-red);">Failed to load attendance history: ${err.message}</td></tr>`;
    }
  }

  function renderAttendanceHistoryPage() {
    if (!attendanceHistoryTableBody) return;
    if (allAttendanceRecords.length === 0) {
      attendanceHistoryTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">No attendance records found yet.</td></tr>';
      if (attHistPageInfo) attHistPageInfo.textContent = 'Page 1 of 1';
      if (attHistPrevBtn) attHistPrevBtn.disabled = true;
      if (attHistNextBtn) attHistNextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allAttendanceRecords.length / ATTENDANCE_PAGE_SIZE);
    if (currentAttendancePage > totalPages) currentAttendancePage = totalPages;
    if (currentAttendancePage < 1) currentAttendancePage = 1;

    const startIdx = (currentAttendancePage - 1) * ATTENDANCE_PAGE_SIZE;
    const pageRecords = allAttendanceRecords.slice(startIdx, startIdx + ATTENDANCE_PAGE_SIZE);

    attendanceHistoryTableBody.innerHTML = pageRecords
      .map((r) => {
        const isOngoing = !r.clock_out_at;
        const statusLabel = isOngoing ? 'On Shift' : (r.status || 'present');
        const statusClass = isOngoing ? 'present' : (r.status === 'present' ? 'present' : 'absent');
        return `
          <tr>
            <td>${formatDateFull(r.work_date || r.shift_date || r.clock_in_at)}</td>
            <td>${formatDate(r.clock_in_at)}</td>
            <td>${formatDate(r.clock_out_at)}</td>
            <td>${r.hours_worked ? Number(r.hours_worked).toFixed(2) + ' hrs' : '-'}</td>
            <td><span class="badge-tag ${statusClass}">${statusLabel}</span></td>
          </tr>
        `;
      })
      .join('');

    if (attHistPageInfo) attHistPageInfo.textContent = `Page ${currentAttendancePage} of ${totalPages}`;
    if (attHistPrevBtn) attHistPrevBtn.disabled = currentAttendancePage <= 1;
    if (attHistNextBtn) attHistNextBtn.disabled = currentAttendancePage >= totalPages;
  }

  // Break History Fetch & 10-row Pagination
  async function loadBreakHistory() {
    if (!breakHistoryTableBody) return;
    try {
      breakHistoryTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading your break logs...</td></tr>';
      const records = await apiRequest('/api/breaks?employee_id=me');
      if (!Array.isArray(records) || records.length === 0) {
        allBreakRecords = [];
        renderBreakHistoryPage();
        return;
      }
      allBreakRecords = records;
      currentBreakPage = 1;
      renderBreakHistoryPage();
    } catch (err) {
      breakHistoryTableBody.innerHTML = `<tr><td colspan="6" style="color: var(--accent-red);">Failed to load break history: ${err.message}</td></tr>`;
    }
  }

  function renderBreakHistoryPage() {
    if (!breakHistoryTableBody) return;
    if (allBreakRecords.length === 0) {
      breakHistoryTableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">No break records found yet.</td></tr>';
      if (brkHistPageInfo) brkHistPageInfo.textContent = 'Page 1 of 1';
      if (brkHistPrevBtn) brkHistPrevBtn.disabled = true;
      if (brkHistNextBtn) brkHistNextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allBreakRecords.length / BREAKS_PAGE_SIZE);
    if (currentBreakPage > totalPages) currentBreakPage = totalPages;
    if (currentBreakPage < 1) currentBreakPage = 1;

    const startIdx = (currentBreakPage - 1) * BREAKS_PAGE_SIZE;
    const pageRecords = allBreakRecords.slice(startIdx, startIdx + BREAKS_PAGE_SIZE);

    breakHistoryTableBody.innerHTML = pageRecords
      .map((r) => {
        const statusClass = r.status === 'completed' ? 'completed' : (r.status === 'active' ? 'present' : 'exceeded');
        const reason = r.break_name || r.break_type_key || 'Break';
        const startAt = r.start_at || r.start_time;
        const endAt = r.end_at || r.end_time;
        return `
          <tr>
            <td>${formatDateFull(startAt)}</td>
            <td><strong>${reason}</strong></td>
            <td>${formatDate(startAt)}</td>
            <td>${formatDate(endAt)}</td>
            <td>${r.duration_minutes !== null && r.duration_minutes !== undefined ? r.duration_minutes + ' min' : '-'}</td>
            <td><span class="badge-tag ${statusClass}">${r.status}</span></td>
          </tr>
        `;
      })
      .join('');

    if (brkHistPageInfo) brkHistPageInfo.textContent = `Page ${currentBreakPage} of ${totalPages}`;
    if (brkHistPrevBtn) brkHistPrevBtn.disabled = currentBreakPage <= 1;
    if (brkHistNextBtn) brkHistNextBtn.disabled = currentBreakPage >= totalPages;
  }

  async function handleClockIn() {
    if (!token) {
      showToast('Please sign in first', 'error');
      showLoginView();
      return;
    }

    try {
      const res = await apiRequest('/api/attendance/clock-in', 'POST');
      showToast('Shift started successfully!', 'success');
      updateUiClockedIn(res.clock_in_at);
      loadAttendanceHistory();
    } catch (err) {
      if (err.status === 409) {
        showToast('Shift already active for today', 'info');
        initAttendanceState();
      } else {
        showToast(err.message, 'error');
      }
    }
  }

  function openClockOutModal() {
    if (clockOutModal) clockOutModal.style.display = 'flex';
  }

  function closeClockOutModal() {
    if (clockOutModal) clockOutModal.style.display = 'none';
  }

  async function executeClockOut() {
    closeClockOutModal();
    try {
      const res = await apiRequest('/api/attendance/clock-out', 'POST');
      showToast(`Shift ended! Work hours: ${res.hours_worked} hrs`, 'success');
      updateUiClockedOut();
      loadAttendanceHistory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleStartBreak() {
    const breakTypeKey = breakSelect.value;
    if (!breakTypeKey) {
      showToast('Please select a break reason', 'error');
      return;
    }

    try {
      const res = await apiRequest('/api/breaks/start', 'POST', { break_type_key: breakTypeKey });
      showToast(`Started break: ${res.break_type_key || breakTypeKey}`, 'success');
      updateUiOnBreak(res.start_at || res.start_time);
      loadBreakHistory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleEndBreak() {
    try {
      const res = await apiRequest('/api/breaks/end', 'POST');
      showToast(`Break ended (${res.duration_minutes} min)`, 'success');
      stopBreakTimer();
      initAttendanceState();
      loadBreakHistory();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function updateUiClockedIn(clockInTimestamp) {
    if (statusBadge) {
      statusBadge.textContent = 'On Shift';
      statusBadge.className = 'status-badge clocked-in';
    }
    if (clockInContainer) clockInContainer.style.display = 'none';
    if (activeShiftControls) activeShiftControls.style.display = 'flex';
    if (activeShiftControls) activeShiftControls.style.flexDirection = 'column';
    if (activeShiftControls) activeShiftControls.style.gap = '1.25rem';
    if (clockOutHeaderBtn) clockOutHeaderBtn.style.display = 'block';
    if (startBreakContainer) startBreakContainer.style.display = 'flex';
    if (endBreakContainer) endBreakContainer.style.display = 'none';

    stopBreakTimer();
    startShiftTimer(clockInTimestamp);
  }

  function updateUiClockedOut() {
    activeClockInIso = null;
    activeBreakStartIso = null;
    if (statusBadge) {
      statusBadge.textContent = 'Off Shift';
      statusBadge.className = 'status-badge off-shift';
    }
    if (clockInContainer) clockInContainer.style.display = 'block';
    if (activeShiftControls) activeShiftControls.style.display = 'none';
    if (clockOutHeaderBtn) clockOutHeaderBtn.style.display = 'none';

    stopShiftTimer();
    stopBreakTimer();
  }

  function updateUiOnBreak(breakStartTimestamp, clockInTimestamp) {
    if (statusBadge) {
      statusBadge.textContent = 'On Break';
      statusBadge.className = 'status-badge on-break';
    }
    if (clockInContainer) clockInContainer.style.display = 'none';
    if (activeShiftControls) activeShiftControls.style.display = 'flex';
    if (activeShiftControls) activeShiftControls.style.flexDirection = 'column';
    if (activeShiftControls) activeShiftControls.style.gap = '1.25rem';
    if (clockOutHeaderBtn) clockOutHeaderBtn.style.display = 'block';
    if (startBreakContainer) startBreakContainer.style.display = 'none';
    if (endBreakContainer) endBreakContainer.style.display = 'block';

    startShiftTimer(clockInTimestamp);
    startBreakTimer(breakStartTimestamp);
  }

  // Event Listeners
  if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', handleLogin);
  if (ssoBtn) ssoBtn.addEventListener('click', handleSsoRedirect);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  if (clockInBtn) clockInBtn.addEventListener('click', handleClockIn);
  if (clockOutHeaderBtn) clockOutHeaderBtn.addEventListener('click', openClockOutModal);
  if (cancelClockOutBtn) cancelClockOutBtn.addEventListener('click', closeClockOutModal);
  if (confirmClockOutBtn) confirmClockOutBtn.addEventListener('click', executeClockOut);

  if (startBreakBtn) startBreakBtn.addEventListener('click', handleStartBreak);
  if (endBreakBtn) endBreakBtn.addEventListener('click', handleEndBreak);

  // Sub-tab controls (Attendance vs Break History)
  if (subTabAttendanceBtn && subTabBreaksBtn && attendanceHistoryView && breakHistoryView) {
    subTabAttendanceBtn.addEventListener('click', () => {
      subTabAttendanceBtn.classList.add('active');
      subTabBreaksBtn.classList.remove('active');
      attendanceHistoryView.style.display = 'block';
      breakHistoryView.style.display = 'none';
    });

    subTabBreaksBtn.addEventListener('click', () => {
      subTabBreaksBtn.classList.add('active');
      subTabAttendanceBtn.classList.remove('active');
      attendanceHistoryView.style.display = 'none';
      breakHistoryView.style.display = 'block';
    });
  }

  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', () => {
      loadAttendanceHistory();
      loadBreakHistory();
      showToast('History refreshed', 'info');
    });
  }

  // Pagination button listeners
  if (attHistPrevBtn) attHistPrevBtn.addEventListener('click', () => { if (currentAttendancePage > 1) { currentAttendancePage--; renderAttendanceHistoryPage(); } });
  if (attHistNextBtn) attHistNextBtn.addEventListener('click', () => { const maxPage = Math.ceil(allAttendanceRecords.length / ATTENDANCE_PAGE_SIZE); if (currentAttendancePage < maxPage) { currentAttendancePage++; renderAttendanceHistoryPage(); } });
  if (brkHistPrevBtn) brkHistPrevBtn.addEventListener('click', () => { if (currentBreakPage > 1) { currentBreakPage--; renderBreakHistoryPage(); } });
  if (brkHistNextBtn) brkHistNextBtn.addEventListener('click', () => { const maxPage = Math.ceil(allBreakRecords.length / BREAKS_PAGE_SIZE); if (currentBreakPage < maxPage) { currentBreakPage++; renderBreakHistoryPage(); } });

  // Initialize view state & parse URL query token or OAuth code if redirected from SSO
  async function initApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const codeFromUrl = urlParams.get('code');

    if (tokenFromUrl) {
      token = tokenFromUrl;
      localStorage.setItem('jdconnect_token', token);
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (codeFromUrl) {
      try {
        const redirectUri = window.location.origin + window.location.pathname;
        const res = await fetch(`${BACKEND_URL}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: codeFromUrl,
            client_id: 'attendance-app',
            redirect_uri: redirectUri,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            token = data.access_token;
            localStorage.setItem('jdconnect_token', token);
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }
      } catch {
        // Fallback to login view
      }
    }

    if (token) {
      showAttendanceView();
      initAttendanceState();
    } else {
      showLoginView();
    }
  }

  initApp();
})();
