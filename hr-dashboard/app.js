(function () {
  const BACKEND_URL = window.LOCATION_BACKEND_URL || 'http://localhost:4000';
  let token = localStorage.getItem('jdconnect_hr_token');

  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const employeeTableBody = document.getElementById('employeeTableBody');
  const attendanceTableBody = document.getElementById('attendanceTableBody');
  const breakTableBody = document.getElementById('breakTableBody');
  const metricActive = document.getElementById('metricActive');
  const metricOnBreak = document.getElementById('metricOnBreak');
  const metricTotal = document.getElementById('metricTotal');
  const toastContainer = document.getElementById('toastContainer');
  const userInfo = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');

  // Login Overlay Elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');

  // Add Employee Modal Elements
  const openAddModalBtn = document.getElementById('openAddModalBtn');
  const closeAddModalBtn = document.getElementById('closeAddModalBtn');
  const cancelAddModalBtn = document.getElementById('cancelAddModalBtn');
  const addEmployeeModal = document.getElementById('addEmployeeModal');
  const addEmployeeForm = document.getElementById('addEmployeeForm');

  function showToast(msg, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function showLoginOverlay() {
    if (loginOverlay) loginOverlay.style.display = 'flex';
  }

  function hideLoginOverlay() {
    if (loginOverlay) loginOverlay.style.display = 'none';
  }

  async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        token = null;
        localStorage.removeItem('jdconnect_hr_token');
        showLoginOverlay();
      }
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }

    try {
      const res = await apiRequest('/api/auth/login', 'POST', { email, password });
      token = res.access_token;
      localStorage.setItem('jdconnect_hr_token', token);
      hideLoginOverlay();
      if (userInfo) userInfo.textContent = `Logged in: ${res.user.full_name}`;
      showToast('Sign in successful!', 'success');
      loadEmployees();
    } catch (err) {
      showToast(err.message || 'Authentication failed', 'error');
    }
  }

  function handleLogout() {
    token = null;
    localStorage.removeItem('jdconnect_hr_token');
    if (userInfo) userInfo.textContent = 'Not logged in';
    showLoginOverlay();
    showToast('Logged out successfully', 'info');
  }

  // Modal handlers
  function openAddModal() {
    if (addEmployeeModal) addEmployeeModal.style.display = 'flex';
  }

  function closeAddModal() {
    if (addEmployeeModal) addEmployeeModal.style.display = 'none';
    if (addEmployeeForm) addEmployeeForm.reset();
  }

  async function handleAddEmployee(e) {
    e.preventDefault();
    const fullName = document.getElementById('addFullName').value.trim();
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value;
    const roleKey = document.getElementById('addRole').value;

    if (!fullName || !email || !password || !roleKey) {
      showToast('Please fill out all required fields', 'error');
      return;
    }

    try {
      await apiRequest('/api/employees', 'POST', {
        full_name: fullName,
        email,
        password,
        role_key: roleKey,
      });
      showToast('Employee created and provisioned successfully!', 'success');
      closeAddModal();
      loadEmployees();
    } catch (err) {
      showToast(err.message || 'Failed to create employee', 'error');
    }
  }

  // Event Listeners
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (openAddModalBtn) openAddModalBtn.addEventListener('click', openAddModal);
  if (closeAddModalBtn) closeAddModalBtn.addEventListener('click', closeAddModal);
  if (cancelAddModalBtn) cancelAddModalBtn.addEventListener('click', closeAddModal);
  if (addEmployeeForm) addEmployeeForm.addEventListener('submit', handleAddEmployee);

  // Navigation tab switching
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      navItems.forEach((i) => i.classList.remove('active'));
      tabContents.forEach((tc) => tc.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');

      if (targetTab === 'employees') loadEmployees();
      if (targetTab === 'attendance') loadAttendance();
      if (targetTab === 'breaks') loadBreaks();
      if (targetTab === 'monitor') loadMonitor();
    });
  });

  async function loadEmployees() {
    if (!token) {
      showLoginOverlay();
      return;
    }
    try {
      const employees = await apiRequest('/api/employees');
      if (!Array.isArray(employees) || !employeeTableBody) return;

      if (employees.length === 0) {
        employeeTableBody.innerHTML = '<tr><td colspan="7">No employees found.</td></tr>';
        return;
      }

      employeeTableBody.innerHTML = employees
        .map((emp) => {
          const zulipBadge = emp.zulip_provisioned
            ? '<span class="badge badge-success">✓ Provisioned</span>'
            : `<span class="badge badge-warning">⚠ Failed</span> <button class="btn btn-primary btn-retry" data-id="${emp.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Retry</button>`;

          return `
            <tr>
              <td>${emp.employee_code || '-'}</td>
              <td><strong>${emp.full_name}</strong></td>
              <td>${emp.email}</td>
              <td>${emp.department || 'Operations'}</td>
              <td>${emp.role || 'employee'}</td>
              <td>${zulipBadge}</td>
              <td>
                <button class="btn btn-primary btn-reset" data-id="${emp.id}" style="background: var(--accent-blue); padding: 0.3rem 0.6rem; font-size: 0.8rem;">Reset Password</button>
              </td>
            </tr>
          `;
        })
        .join('');

      // Add retry button event listeners
      document.querySelectorAll('.btn-retry').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          try {
            await apiRequest(`/api/employees/${id}/retry-zulip-provisioning`, 'POST');
            showToast('Zulip account provisioned successfully!', 'success');
            loadEmployees();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

      // Add reset password event listeners
      document.querySelectorAll('.btn-reset').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          const newPass = prompt('Enter new password for employee (min 8 chars):');
          if (!newPass || newPass.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
          }
          try {
            await apiRequest(`/api/employees/${id}/reset-password`, 'POST', { new_password: newPass });
            showToast('Password reset successfully!', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      if (employeeTableBody) {
        employeeTableBody.innerHTML = `<tr><td colspan="7" style="color: var(--accent-red);">Error loading employees: ${err.message}</td></tr>`;
      }
    }
  }

  async function loadAttendance() {
    if (!token) return;
    try {
      const records = await apiRequest('/api/attendance');
      if (!Array.isArray(records) || !attendanceTableBody) return;

      attendanceTableBody.innerHTML = records
        .map((r) => `
          <tr>
            <td>${r.work_date}</td>
            <td><strong>${r.employee_name || r.employee_id}</strong></td>
            <td>${r.clock_in_at ? new Date(r.clock_in_at).toLocaleTimeString() : '-'}</td>
            <td>${r.clock_out_at ? new Date(r.clock_out_at).toLocaleTimeString() : 'Active'}</td>
            <td>${r.hours_worked || '-'} hrs</td>
            <td><span class="badge badge-success">${r.status}</span></td>
          </tr>
        `)
        .join('');
    } catch {
      // Graceful fallback
    }
  }

  async function loadBreaks() {
    if (!token) return;
    try {
      const records = await apiRequest('/api/breaks');
      if (!Array.isArray(records) || !breakTableBody) return;

      breakTableBody.innerHTML = records
        .map((b) => `
          <tr>
            <td><strong>${b.employee_name || b.employee_id}</strong></td>
            <td>${b.break_type_key}</td>
            <td>${new Date(b.start_time).toLocaleTimeString()}</td>
            <td>${b.end_time ? new Date(b.end_time).toLocaleTimeString() : 'Active'}</td>
            <td>${b.duration_minutes || '-'}</td>
            <td>${b.limit_minutes || 'Unlimited'}</td>
            <td><span class="badge ${b.status === 'exceeded' ? 'badge-danger' : 'badge-success'}">${b.status}</span></td>
          </tr>
        `)
        .join('');
    } catch {
      // Graceful fallback
    }
  }

  async function loadMonitor() {
    if (!token) return;
    try {
      const summary = await apiRequest('/api/attendance/monitor');
      if (metricActive) metricActive.textContent = summary.working_count || 0;
      if (metricOnBreak) metricOnBreak.textContent = summary.on_break_count || 0;
      if (metricTotal) metricTotal.textContent = summary.total_clocked_in || 0;
    } catch {
      // Graceful fallback
    }
  }

  // Initial load
  if (!token) {
    showLoginOverlay();
  } else {
    loadEmployees();
  }
})();
