(function () {
  const BACKEND_URL = window.LOCATION_BACKEND_URL || 'http://localhost:4000';

  let token = localStorage.getItem('jdconnect_token');
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('token')) {
    token = urlParams.get('token');
    localStorage.setItem('jdconnect_token', token);
  }

  const clockInBtn = document.getElementById('clockInBtn');
  const clockOutBtn = document.getElementById('clockOutBtn');
  const statusBadge = document.getElementById('statusBadge');
  const timerEl = document.getElementById('timer');
  const breakSection = document.getElementById('breakSection');
  const breakSelect = document.getElementById('breakSelect');
  const startBreakBtn = document.getElementById('startBreakBtn');
  const endBreakBtn = document.getElementById('endBreakBtn');
  const toastContainer = document.getElementById('toastContainer');

  let timerInterval = null;

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function startTimer(initialSeconds = 0) {
    if (timerInterval) clearInterval(timerInterval);
    let seconds = initialSeconds;
    timerInterval = setInterval(() => {
      seconds++;
      const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (timerEl) timerEl.textContent = '00:00:00';
  }

  async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || `HTTP error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
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

  async function handleClockIn() {
    try {
      const res = await apiRequest('/api/attendance/clock-in', 'POST');
      showToast('Successfully clocked in!', 'success');
      updateUiClockedIn(res.clock_in_at);
    } catch (err) {
      if (err.status === 409) {
        showToast('Already clocked in for today', 'error');
      } else {
        showToast(err.message, 'error');
      }
    }
  }

  async function handleClockOut() {
    try {
      const res = await apiRequest('/api/attendance/clock-out', 'POST');
      showToast(`Clocked out! Work hours: ${res.hours_worked} hrs`, 'success');
      updateUiClockedOut();
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
      updateUiOnBreak();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleEndBreak() {
    try {
      const res = await apiRequest('/api/breaks/end', 'POST');
      showToast(`Break ended (${res.duration_minutes} min)`, 'success');
      updateUiClockedIn();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function updateUiClockedIn(clockInTimestamp) {
    if (statusBadge) {
      statusBadge.textContent = 'Clocked In';
      statusBadge.className = 'status-badge clocked-in';
    }
    if (clockInBtn) clockInBtn.style.display = 'none';
    if (clockOutBtn) clockOutBtn.style.display = 'flex';
    if (breakSection) breakSection.style.display = 'block';
    if (startBreakBtn) startBreakBtn.style.display = 'flex';
    if (endBreakBtn) endBreakBtn.style.display = 'none';

    if (clockInTimestamp) {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(clockInTimestamp).getTime()) / 1000));
      startTimer(elapsed);
    } else {
      startTimer(0);
    }
  }

  function updateUiClockedOut() {
    if (statusBadge) {
      statusBadge.textContent = 'Off Shift';
      statusBadge.className = 'status-badge off-shift';
    }
    if (clockInBtn) clockInBtn.style.display = 'flex';
    if (clockOutBtn) clockOutBtn.style.display = 'none';
    if (breakSection) breakSection.style.display = 'none';
    stopTimer();
  }

  function updateUiOnBreak() {
    if (statusBadge) {
      statusBadge.textContent = 'On Break';
      statusBadge.className = 'status-badge on-break';
    }
    if (startBreakBtn) startBreakBtn.style.display = 'none';
    if (endBreakBtn) endBreakBtn.style.display = 'flex';
  }

  if (clockInBtn) clockInBtn.addEventListener('click', handleClockIn);
  if (clockOutBtn) clockOutBtn.addEventListener('click', handleClockOut);
  if (startBreakBtn) startBreakBtn.addEventListener('click', handleStartBreak);
  if (endBreakBtn) endBreakBtn.addEventListener('click', handleEndBreak);

  // Initialize
  loadBreakTypes();
})();
