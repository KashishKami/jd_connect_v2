(function () {
  const BACKEND_URL = window.LOCATION_BACKEND_URL || 'http://localhost:4000';

  const loginView = document.getElementById('loginView');
  const attendanceView = document.getElementById('attendanceView');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const ssoBtn = document.getElementById('ssoBtn');
  const userNameLabel = document.getElementById('userNameLabel');
  const userEmailLabel = document.getElementById('userEmailLabel');
  const logoutBtn = document.getElementById('logoutBtn');

  // Tab controls
  const tabConsoleBtn = document.getElementById('tabConsoleBtn');
  const tabHistoryBtn = document.getElementById('tabHistoryBtn');
  const consolePanel = document.getElementById('consolePanel');
  const historyPanel = document.getElementById('historyPanel');

  const subTabAttendanceBtn = document.getElementById('subTabAttendanceBtn');
  const subTabBreaksBtn = document.getElementById('subTabBreaksBtn');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const attendanceHistoryView = document.getElementById('attendanceHistoryView');
  const breakHistoryView = document.getElementById('breakHistoryView');
  const attendanceHistoryTableBody = document.getElementById('attendanceHistoryTableBody');
  const breakHistoryTableBody = document.getElementById('breakHistoryTableBody');

  // Shift & Break DOM elements
  const clockInContainer = document.getElementById('clockInContainer');
  const activeShiftControls = document.getElementById('activeShiftControls');
  const startBreakContainer = document.getElementById('startBreakContainer');
  const endBreakContainer = document.getElementById('endBreakContainer');
  const clockInBtn = document.getElementById('clockInBtn');
  const clockOutBtn = document.getElementById('clockOutBtn');
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
  }

  function showAttendanceView() {
    if (loginView) loginView.style.display = 'none';
    if (attendanceView) attendanceView.style.display = 'block';
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

  async function loadAttendanceHistory() {
    if (!attendanceHistoryTableBody) return;
    try {
      attendanceHistoryTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Loading your attendance logs...</td></tr>';
      const records = await apiRequest('/api/attendance');
      if (!Array.isArray(records) || records.length === 0) {
        attendanceHistoryTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No attendance records found yet.</td></tr>';
        return;
      }

      attendanceHistoryTableBody.innerHTML = '';
      records.forEach((r) => {
        const tr = document.createElement('tr');
        const isOngoing = !r.clock_out_at;
        const statusLabel = isOngoing ? 'On Shift' : (r.status || 'present');
        const statusClass = isOngoing ? 'present' : (r.status === 'present' ? 'present' : 'absent');
        tr.innerHTML = `
          <td>${formatDateFull(r.work_date || r.shift_date || r.clock_in_at)}</td>
          <td>${formatDate(r.clock_in_at)}</td>
          <td>${formatDate(r.clock_out_at)}</td>
          <td>${r.hours_worked ? Number(r.hours_worked).toFixed(2) + ' hrs' : '-'}</td>
          <td><span class="badge-tag ${statusClass}">${statusLabel}</span></td>
        `;
        attendanceHistoryTableBody.appendChild(tr);
      });
    } catch (err) {
      attendanceHistoryTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Failed to load attendance history: ${err.message}</td></tr>`;
    }
  }

  async function loadBreakHistory() {
    if (!breakHistoryTableBody) return;
    try {
      breakHistoryTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Loading your break logs...</td></tr>';
      const records = await apiRequest('/api/breaks');
      if (!Array.isArray(records) || records.length === 0) {
        breakHistoryTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No break records found yet.</td></tr>';
        return;
      }

      breakHistoryTableBody.innerHTML = '';
      records.forEach((r) => {
        const tr = document.createElement('tr');
        const statusClass = r.status === 'completed' ? 'completed' : (r.status === 'active' ? 'present' : 'exceeded');
        const reason = r.break_name || r.break_type_key || 'Break';
        const startAt = r.start_at || r.start_time;
        const endAt = r.end_at || r.end_time;
        tr.innerHTML = `
          <td>${formatDateFull(startAt)}</td>
          <td><strong>${reason}</strong></td>
          <td>${formatDate(startAt)}</td>
          <td>${formatDate(endAt)}</td>
          <td>${r.duration_minutes !== null && r.duration_minutes !== undefined ? r.duration_minutes + ' min' : '-'}</td>
          <td><span class="badge-tag ${statusClass}">${r.status}</span></td>
        `;
        breakHistoryTableBody.appendChild(tr);
      });
    } catch (err) {
      breakHistoryTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load break history: ${err.message}</td></tr>`;
    }
  }

  async function handleClockIn() {
    if (!token) {
      showToast('Please sign in first', 'error');
      showLoginView();
      return;
    }

    try {
      const res = await apiRequest('/api/attendance/clock-in', 'POST');
      showToast('Successfully clocked in!', 'success');
      updateUiClockedIn(res.clock_in_at);
    } catch (err) {
      if (err.status === 409) {
        showToast('Already clocked in for today', 'info');
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
      showToast(`Clocked out! Work hours: ${res.hours_worked} hrs`, 'success');
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
      statusBadge.textContent = 'Clocked In';
      statusBadge.className = 'status-badge clocked-in';
    }
    if (clockInContainer) clockInContainer.style.display = 'none';
    if (activeShiftControls) activeShiftControls.style.display = 'block';
    if (clockOutBtn) clockOutBtn.style.display = 'block';
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
    if (clockOutBtn) clockOutBtn.style.display = 'none';

    stopShiftTimer();
    stopBreakTimer();
  }

  function updateUiOnBreak(breakStartTimestamp, clockInTimestamp) {
    if (statusBadge) {
      statusBadge.textContent = 'On Break';
      statusBadge.className = 'status-badge on-break';
    }
    if (clockInContainer) clockInContainer.style.display = 'none';
    if (activeShiftControls) activeShiftControls.style.display = 'block';
    if (clockOutBtn) clockOutBtn.style.display = 'block';
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
  if (clockOutBtn) clockOutBtn.addEventListener('click', openClockOutModal);
  if (cancelClockOutBtn) cancelClockOutBtn.addEventListener('click', closeClockOutModal);
  if (confirmClockOutBtn) confirmClockOutBtn.addEventListener('click', executeClockOut);

  if (startBreakBtn) startBreakBtn.addEventListener('click', handleStartBreak);
  if (endBreakBtn) endBreakBtn.addEventListener('click', handleEndBreak);

  // Tab switching
  if (tabConsoleBtn && tabHistoryBtn && consolePanel && historyPanel) {
    tabConsoleBtn.addEventListener('click', () => {
      tabConsoleBtn.classList.add('active');
      tabHistoryBtn.classList.remove('active');
      consolePanel.style.display = 'block';
      historyPanel.style.display = 'none';
    });

    tabHistoryBtn.addEventListener('click', () => {
      tabHistoryBtn.classList.add('active');
      tabConsoleBtn.classList.remove('active');
      consolePanel.style.display = 'none';
      historyPanel.style.display = 'block';
      loadAttendanceHistory();
      loadBreakHistory();
    });
  }

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
