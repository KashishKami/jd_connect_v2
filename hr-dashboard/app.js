(function () {
  const BACKEND_URL = window.LOCATION_BACKEND_URL || 'http://localhost:4000';
  let token = localStorage.getItem('jdconnect_hr_token');

  // Navigation and Layout Elements
  const tabContents = document.querySelectorAll('.tab-content');
  const employeeTableBody = document.getElementById('employeeTableBody');
  const attendanceTableBody = document.getElementById('attendanceTableBody');
  const breakTableBody = document.getElementById('breakTableBody');
  const toastContainer = document.getElementById('toastContainer');
  const userInfo = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDrawer = document.getElementById('navDrawer');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');

  // Employee Filters & Pagination
  const searchEmployeeInput = document.getElementById('searchEmployeeInput');
  const filterDepartment = document.getElementById('filterDepartment');
  const filterRole = document.getElementById('filterRole');
  const filterStatus = document.getElementById('filterStatus');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');

  let currentEmployeePage = 1;
  const EMPLOYEES_PER_PAGE = 20;
  let allFilteredEmployees = [];
  let departmentsList = [];

  // Attendance Audit Filters & Pagination
  const attSearchInput = document.getElementById('attSearchInput');
  const attDateFilter = document.getElementById('attDateFilter');
  const attStatusFilter = document.getElementById('attStatusFilter');
  const todayAttBtn = document.getElementById('todayAttBtn');
  const attPrevBtn = document.getElementById('attPrevBtn');
  const attNextBtn = document.getElementById('attNextBtn');
  const attPageInfo = document.getElementById('attPageInfo');

  let currentAttendancePage = 1;
  const ATTENDANCE_PER_PAGE = 20;
  let allFilteredAttendance = [];

  // Break Audit Filters & Pagination
  const brkSearchInput = document.getElementById('brkSearchInput');
  const brkDateFilter = document.getElementById('brkDateFilter');
  const brkStatusFilter = document.getElementById('brkStatusFilter');
  const todayBrkBtn = document.getElementById('todayBrkBtn');
  const brkPrevBtn = document.getElementById('brkPrevBtn');
  const brkNextBtn = document.getElementById('brkNextBtn');
  const brkPageInfo = document.getElementById('brkPageInfo');

  let currentBreakPage = 1;
  const BREAKS_PER_PAGE = 20;
  let allFilteredBreaks = [];

  // Dashboard Metric Elements
  const metricPresent = document.getElementById('metric-present');
  const metricOnBreak = document.getElementById('metric-on-break');
  const metricAbsent = document.getElementById('metric-absent');
  const metricLate = document.getElementById('metric-late');
  const metricHalfDay = document.getElementById('metric-half-day');

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

  // Edit Employee Modal Elements
  const editEmployeeModal = document.getElementById('editEmployeeModal');
  const editEmployeeForm = document.getElementById('editEmployeeForm');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');

  // EST Date Helper
  function getTodayEST() {
    try {
      const now = new Date();
      const estStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      return estStr; // Format: YYYY-MM-DD
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  // Theme Toggle Initialization
  function initTheme() {
    const savedTheme = localStorage.getItem('jd_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-theme');
    localStorage.setItem('jd_theme', isDark ? 'dark' : 'light');
    if (themeToggleBtn) themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
  }

  initTheme();
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // Mobile Drawer Handlers
  if (hamburgerBtn && navDrawer) {
    hamburgerBtn.addEventListener('click', () => navDrawer.classList.add('open'));
  }
  if (drawerCloseBtn && navDrawer) {
    drawerCloseBtn.addEventListener('click', () => navDrawer.classList.remove('open'));
  }

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

  function formatTime(isoString) {
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

  function formatDate(isoString) {
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

  async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const contentType = res.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { error: `Server error (${res.status})` };
    }

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
      if (userInfo) userInfo.textContent = `Logged in: ${res.user.full_name || res.user.email}`;
      showToast('Sign in successful!', 'success');
      loadDepartments();
      loadDashboard();
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

  // Load Departments
  async function loadDepartments() {
    if (!token) return;
    try {
      departmentsList = await apiRequest('/api/departments');
      if (!Array.isArray(departmentsList)) return;

      const optionsHtml = '<option value="">All Departments</option>' +
        departmentsList.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      const modalOptionsHtml = '<option value="">Select Department...</option>' +
        departmentsList.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

      if (filterDepartment) filterDepartment.innerHTML = optionsHtml;
      const addDeptSelect = document.getElementById('addDepartment');
      if (addDeptSelect) addDeptSelect.innerHTML = modalOptionsHtml;
      const editDeptSelect = document.getElementById('editDepartment');
      if (editDeptSelect) editDeptSelect.innerHTML = modalOptionsHtml;
    } catch {
      // Non-blocking
    }
  }

  // Modal handlers
  function openAddModal() {
    if (addEmployeeModal) addEmployeeModal.style.display = 'flex';
  }

  function closeAddModal() {
    if (addEmployeeModal) addEmployeeModal.style.display = 'none';
    if (addEmployeeForm) addEmployeeForm.reset();
  }

  function openEditModal(emp) {
    if (!editEmployeeModal) return;
    document.getElementById('editEmployeeId').value = emp.id;
    document.getElementById('editFullName').value = emp.full_name || '';
    document.getElementById('editAlias').value = emp.alias || '';
    document.getElementById('editEmail').value = emp.email || '';
    document.getElementById('editDesignation').value = emp.designation || '';
    document.getElementById('editDepartment').value = emp.department_id || '';
    document.getElementById('editRole').value = emp.role_key || emp.role || 'employee';
    document.getElementById('editStatus').value = emp.employment_status || emp.status || 'active';
    document.getElementById('editPassword').value = '';

    editEmployeeModal.style.display = 'flex';
  }

  function closeEditModal() {
    if (editEmployeeModal) editEmployeeModal.style.display = 'none';
    if (editEmployeeForm) editEmployeeForm.reset();
  }

  async function handleAddEmployee(e) {
    e.preventDefault();
    const fullName = document.getElementById('addFullName').value.trim();
    const alias = document.getElementById('addAlias').value.trim();
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value;
    const roleKey = document.getElementById('addRole').value;
    const designation = document.getElementById('addDesignation').value.trim();
    const departmentId = document.getElementById('addDepartment').value;

    if (!fullName || !email || !password || !roleKey) {
      showToast('Please fill out all required fields', 'error');
      return;
    }

    try {
      const payload = {
        full_name: fullName,
        email,
        password,
        role_key: roleKey,
      };
      if (alias) payload.alias = alias;
      if (designation) payload.designation = designation;
      if (departmentId) payload.department_id = departmentId;

      await apiRequest('/api/employees', 'POST', payload);
      showToast('Employee created and provisioned successfully!', 'success');
      closeAddModal();
      loadEmployees();
    } catch (err) {
      showToast(err.message || 'Failed to create employee', 'error');
    }
  }

  async function handleEditEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('editEmployeeId').value;
    const fullName = document.getElementById('editFullName').value.trim();
    const alias = document.getElementById('editAlias').value.trim();
    const designation = document.getElementById('editDesignation').value.trim();
    const departmentId = document.getElementById('editDepartment').value;
    const roleKey = document.getElementById('editRole').value;
    const employmentStatus = document.getElementById('editStatus').value;
    const newPassword = document.getElementById('editPassword').value;

    try {
      const payload = {};
      if (fullName) payload.full_name = fullName;
      if (alias !== undefined) payload.alias = alias;
      if (designation !== undefined) payload.designation = designation;
      if (departmentId !== undefined) payload.department_id = departmentId || null;
      if (roleKey) payload.role_key = roleKey;
      if (employmentStatus) payload.employment_status = employmentStatus;
      if (newPassword && newPassword.length >= 8) payload.new_password = newPassword;

      await apiRequest(`/api/employees/${id}`, 'PATCH', payload);
      showToast('Employee updated successfully!', 'success');
      closeEditModal();
      loadEmployees();
    } catch (err) {
      showToast(err.message || 'Failed to update employee', 'error');
    }
  }

  // Debounce Helper
  function debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Event Listeners
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (openAddModalBtn) openAddModalBtn.addEventListener('click', openAddModal);
  if (closeAddModalBtn) closeAddModalBtn.addEventListener('click', closeAddModal);
  if (cancelAddModalBtn) cancelAddModalBtn.addEventListener('click', closeAddModal);
  if (addEmployeeForm) addEmployeeForm.addEventListener('submit', handleAddEmployee);

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
  if (cancelEditModalBtn) cancelEditModalBtn.addEventListener('click', closeEditModal);
  if (editEmployeeForm) editEmployeeForm.addEventListener('submit', handleEditEmployee);

  // Employee filter listeners
  if (searchEmployeeInput) searchEmployeeInput.addEventListener('input', debounce(() => { currentEmployeePage = 1; loadEmployees(); }, 300));
  if (filterDepartment) filterDepartment.addEventListener('change', () => { currentEmployeePage = 1; loadEmployees(); });
  if (filterRole) filterRole.addEventListener('change', () => { currentEmployeePage = 1; loadEmployees(); });
  if (filterStatus) filterStatus.addEventListener('change', () => { currentEmployeePage = 1; loadEmployees(); });

  // Employee pagination button listeners
  if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentEmployeePage > 1) { currentEmployeePage--; renderEmployeePage(); } });
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => { const maxPage = Math.ceil(allFilteredEmployees.length / EMPLOYEES_PER_PAGE); if (currentEmployeePage < maxPage) { currentEmployeePage++; renderEmployeePage(); } });

  // Attendance Audit Filter listeners
  if (attSearchInput) attSearchInput.addEventListener('input', debounce(() => { currentAttendancePage = 1; loadAttendance(); }, 300));
  if (attDateFilter) attDateFilter.addEventListener('change', () => { currentAttendancePage = 1; loadAttendance(); });
  if (attStatusFilter) attStatusFilter.addEventListener('change', () => { currentAttendancePage = 1; loadAttendance(); });
  if (todayAttBtn) todayAttBtn.addEventListener('click', () => { if (attDateFilter) attDateFilter.value = getTodayEST(); currentAttendancePage = 1; loadAttendance(); });
  if (attPrevBtn) attPrevBtn.addEventListener('click', () => { if (currentAttendancePage > 1) { currentAttendancePage--; renderAttendancePage(); } });
  if (attNextBtn) attNextBtn.addEventListener('click', () => { const maxPage = Math.ceil(allFilteredAttendance.length / ATTENDANCE_PER_PAGE); if (currentAttendancePage < maxPage) { currentAttendancePage++; renderAttendancePage(); } });

  // Break Audit Filter listeners
  if (brkSearchInput) brkSearchInput.addEventListener('input', debounce(() => { currentBreakPage = 1; loadBreaks(); }, 300));
  if (brkDateFilter) brkDateFilter.addEventListener('change', () => { currentBreakPage = 1; loadBreaks(); });
  if (brkStatusFilter) brkStatusFilter.addEventListener('change', () => { currentBreakPage = 1; loadBreaks(); });
  if (todayBrkBtn) todayBrkBtn.addEventListener('click', () => { if (brkDateFilter) brkDateFilter.value = getTodayEST(); currentBreakPage = 1; loadBreaks(); });
  if (brkPrevBtn) brkPrevBtn.addEventListener('click', () => { if (currentBreakPage > 1) { currentBreakPage--; renderBreakPage(); } });
  if (brkNextBtn) brkNextBtn.addEventListener('click', () => { const maxPage = Math.ceil(allFilteredBreaks.length / BREAKS_PER_PAGE); if (currentBreakPage < maxPage) { currentBreakPage++; renderBreakPage(); } });

  function switchTab(targetTab) {
    document.querySelectorAll('.nav-item').forEach((i) => {
      if (i.getAttribute('data-tab') === targetTab) {
        i.classList.add('active');
      } else {
        i.classList.remove('active');
      }
    });
    tabContents.forEach((tc) => tc.classList.remove('active'));

    const activeContent = document.getElementById(`tab-${targetTab}`);
    if (activeContent) activeContent.classList.add('active');
    if (navDrawer) navDrawer.classList.remove('open');

    if (targetTab === 'dashboard') loadDashboard();
    if (targetTab === 'employees') { loadDepartments(); loadEmployees(); }
    if (targetTab === 'attendance') loadAttendance();
    if (targetTab === 'breaks') loadBreaks();
  }

  // Navigation tab switching
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Clickable Metric Card Handler (Deep Link Filter Pre-application)
  document.querySelectorAll('.clickable-card').forEach((card) => {
    card.addEventListener('click', () => {
      const targetTab = card.getAttribute('data-target-tab');
      const targetStatus = card.getAttribute('data-target-status');

      window._pendingFilter = {
        status: targetStatus,
        date: getTodayEST(),
      };

      switchTab(targetTab);
    });
  });

  async function loadDashboard() {
    if (!token) {
      showLoginOverlay();
      return;
    }
    try {
      const summary = await apiRequest('/api/attendance/summary/today');
      const presentCount = summary.present || 0;
      const onBreakCount = summary.on_break || 0;
      const totalEmp = summary.total_employees || 0;
      const absentCount = summary.absent !== undefined ? summary.absent : Math.max(0, totalEmp - presentCount);
      const lateCount = summary.late || 0;
      const halfDayCount = summary.half_day || 0;

      if (metricPresent) metricPresent.textContent = presentCount;
      if (metricOnBreak) metricOnBreak.textContent = onBreakCount;
      if (metricAbsent) metricAbsent.textContent = absentCount;
      if (metricLate) metricLate.textContent = lateCount;
      if (metricHalfDay) metricHalfDay.textContent = halfDayCount;
    } catch {
      showToast('Failed to load dashboard metrics', 'error');
    }
  }

  async function loadEmployees() {
    if (!token) {
      showLoginOverlay();
      return;
    }
    try {
      const search = searchEmployeeInput ? searchEmployeeInput.value.trim() : '';
      const deptId = filterDepartment ? filterDepartment.value : '';
      const roleKey = filterRole ? filterRole.value : '';
      const status = filterStatus ? filterStatus.value : '';

      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (deptId) queryParams.append('department_id', deptId);
      if (roleKey) queryParams.append('role_key', roleKey);
      if (status) queryParams.append('status', status);

      const endpoint = `/api/employees${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const employees = await apiRequest(endpoint);
      if (!Array.isArray(employees) || !employeeTableBody) return;

      allFilteredEmployees = employees;
      renderEmployeePage();
    } catch (err) {
      if (employeeTableBody) {
        employeeTableBody.innerHTML = `<tr><td colspan="10" style="color: var(--accent-red);">Error loading employees: ${err.message}</td></tr>`;
      }
    }
  }

  function renderEmployeePage() {
    if (!employeeTableBody) return;
    if (allFilteredEmployees.length === 0) {
      employeeTableBody.innerHTML = '<tr><td colspan="10">No employees found matching filter criteria.</td></tr>';
      if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1';
      if (prevPageBtn) prevPageBtn.disabled = true;
      if (nextPageBtn) nextPageBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allFilteredEmployees.length / EMPLOYEES_PER_PAGE);
    if (currentEmployeePage > totalPages) currentEmployeePage = totalPages;
    if (currentEmployeePage < 1) currentEmployeePage = 1;

    const startIdx = (currentEmployeePage - 1) * EMPLOYEES_PER_PAGE;
    const pageEmployees = allFilteredEmployees.slice(startIdx, startIdx + EMPLOYEES_PER_PAGE);

    employeeTableBody.innerHTML = pageEmployees
      .map((emp) => {
        const zulipBadge = emp.zulip_provisioned
          ? '<span class="badge badge-success">✓ Provisioned</span>'
          : `<span class="badge badge-warning">⚠ Failed</span> <button class="btn btn-primary btn-retry" data-id="${emp.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Retry</button>`;

        let statusClass = 'badge-success';
        if (emp.employment_status === 'suspended' || emp.employment_status === 'terminated') statusClass = 'badge-danger';
        else if (emp.employment_status === 'probation' || emp.employment_status === 'on_leave') statusClass = 'badge-warning';

        const empJson = JSON.stringify(emp).replace(/"/g, '&quot;');

        return `
          <tr>
            <td>${emp.employee_code || '-'}</td>
            <td><strong>${emp.full_name}</strong></td>
            <td>${emp.alias || '-'}</td>
            <td>${emp.email}</td>
            <td>${emp.designation || '-'}</td>
            <td>${emp.department || 'Operations'}</td>
            <td>${emp.role || emp.role_key || 'employee'}</td>
            <td><span class="badge ${statusClass}">${emp.employment_status || 'active'}</span></td>
            <td>${zulipBadge}</td>
            <td>
              <button class="btn btn-primary btn-edit" data-emp="${empJson}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Edit</button>
            </td>
          </tr>
        `;
      })
      .join('');

    if (pageIndicator) pageIndicator.textContent = `Page ${currentEmployeePage} of ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentEmployeePage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentEmployeePage >= totalPages;

    // Retry button listeners
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

    // Edit button listeners
    document.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const empAttr = e.target.getAttribute('data-emp');
        if (empAttr) {
          const empData = JSON.parse(empAttr.replace(/&quot;/g, '"'));
          openEditModal(empData);
        }
      });
    });
  }

  async function loadAttendance() {
    if (!token) return;
    try {
      // Check and consume pending filter from Dashboard metric cards
      if (window._pendingFilter) {
        if (attStatusFilter) attStatusFilter.value = window._pendingFilter.status === 'present' ? '' : (window._pendingFilter.status || '');
        if (attDateFilter) attDateFilter.value = window._pendingFilter.date || '';
        window._pendingFilter = null;
      }

      const search = attSearchInput ? attSearchInput.value.trim() : '';
      const date = attDateFilter ? attDateFilter.value : '';
      const status = attStatusFilter ? attStatusFilter.value : '';

      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (date) {
        queryParams.append('from', date);
        queryParams.append('to', date);
      }
      if (status) queryParams.append('status', status);

      const endpoint = `/api/attendance${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const records = await apiRequest(endpoint);
      if (!Array.isArray(records) || !attendanceTableBody) return;

      allFilteredAttendance = records;
      currentAttendancePage = 1;
      renderAttendancePage();
    } catch (err) {
      if (attendanceTableBody) {
        attendanceTableBody.innerHTML = `<tr><td colspan="6" style="color: var(--accent-red);">Error loading attendance logs: ${err.message}</td></tr>`;
      }
    }
  }

  function renderAttendancePage() {
    if (!attendanceTableBody) return;
    if (allFilteredAttendance.length === 0) {
      attendanceTableBody.innerHTML = '<tr><td colspan="6">No attendance records found matching criteria.</td></tr>';
      if (attPageInfo) attPageInfo.textContent = 'Page 1 of 1';
      if (attPrevBtn) attPrevBtn.disabled = true;
      if (attNextBtn) attNextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allFilteredAttendance.length / ATTENDANCE_PER_PAGE);
    if (currentAttendancePage > totalPages) currentAttendancePage = totalPages;
    if (currentAttendancePage < 1) currentAttendancePage = 1;

    const startIdx = (currentAttendancePage - 1) * ATTENDANCE_PER_PAGE;
    const pageRecords = allFilteredAttendance.slice(startIdx, startIdx + ATTENDANCE_PER_PAGE);

    attendanceTableBody.innerHTML = pageRecords
      .map((r) => {
        const empName = r.employee_name || r.employee_email || r.employee_id;
        const isOngoing = !r.clock_out_at;
        const statusBadge = isOngoing
          ? '<span class="badge badge-success">On Shift</span>'
          : `<span class="badge ${r.status === 'present' ? 'badge-success' : 'badge-warning'}">${r.status}</span>`;
        return `
          <tr>
            <td>${formatDate(r.work_date || r.clock_in_at)}</td>
            <td><strong>${empName}</strong></td>
            <td>${formatTime(r.clock_in_at)}</td>
            <td>${isOngoing ? '-' : formatTime(r.clock_out_at)}</td>
            <td>${r.hours_worked ? Number(r.hours_worked).toFixed(2) + ' hrs' : '-'}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join('');

    if (attPageInfo) attPageInfo.textContent = `Page ${currentAttendancePage} of ${totalPages}`;
    if (attPrevBtn) attPrevBtn.disabled = currentAttendancePage <= 1;
    if (attNextBtn) attNextBtn.disabled = currentAttendancePage >= totalPages;
  }

  async function loadBreaks() {
    if (!token) return;
    try {
      // Check and consume pending filter from Dashboard metric cards
      if (window._pendingFilter) {
        if (brkStatusFilter) brkStatusFilter.value = window._pendingFilter.status || '';
        if (brkDateFilter) brkDateFilter.value = window._pendingFilter.date || '';
        window._pendingFilter = null;
      }

      const search = brkSearchInput ? brkSearchInput.value.trim() : '';
      const date = brkDateFilter ? brkDateFilter.value : '';
      const status = brkStatusFilter ? brkStatusFilter.value : '';

      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (date) {
        queryParams.append('from', date);
        queryParams.append('to', date);
      }
      if (status) queryParams.append('status', status);

      const endpoint = `/api/breaks${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const records = await apiRequest(endpoint);
      if (!Array.isArray(records) || !breakTableBody) return;

      allFilteredBreaks = records;
      currentBreakPage = 1;
      renderBreakPage();
    } catch (err) {
      if (breakTableBody) {
        breakTableBody.innerHTML = `<tr><td colspan="7" style="color: var(--accent-red);">Error loading break logs: ${err.message}</td></tr>`;
      }
    }
  }

  function renderBreakPage() {
    if (!breakTableBody) return;
    if (allFilteredBreaks.length === 0) {
      breakTableBody.innerHTML = '<tr><td colspan="7">No break records found matching criteria.</td></tr>';
      if (brkPageInfo) brkPageInfo.textContent = 'Page 1 of 1';
      if (brkPrevBtn) brkPrevBtn.disabled = true;
      if (brkNextBtn) brkNextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(allFilteredBreaks.length / BREAKS_PER_PAGE);
    if (currentBreakPage > totalPages) currentBreakPage = totalPages;
    if (currentBreakPage < 1) currentBreakPage = 1;

    const startIdx = (currentBreakPage - 1) * BREAKS_PER_PAGE;
    const pageRecords = allFilteredBreaks.slice(startIdx, startIdx + BREAKS_PER_PAGE);

    breakTableBody.innerHTML = pageRecords
      .map((b) => {
        const empName = b.employee_name || b.employee_email || b.employee_id;
        const breakReason = b.break_name || b.break_type_key || 'Break';
        const startAt = b.start_at || b.start_time;
        const endAt = b.end_at || b.end_time;
        const isOngoing = !endAt || b.status === 'active';
        let statusBadge = '<span class="badge badge-success">completed</span>';
        if (b.status === 'active' || isOngoing) {
          statusBadge = '<span class="badge badge-warning">active</span>';
        } else if (b.status === 'exceeded') {
          statusBadge = '<span class="badge badge-danger">exceeded</span>';
        }
        return `
          <tr>
            <td><strong>${empName}</strong></td>
            <td>${breakReason}</td>
            <td>${formatTime(startAt)}</td>
            <td>${isOngoing ? '-' : formatTime(endAt)}</td>
            <td>${b.duration_minutes !== null && b.duration_minutes !== undefined ? b.duration_minutes : '-'}</td>
            <td>${b.limit_minutes ? b.limit_minutes + ' min' : 'Unlimited'}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join('');

    if (brkPageInfo) brkPageInfo.textContent = `Page ${currentBreakPage} of ${totalPages}`;
    if (brkPrevBtn) brkPrevBtn.disabled = currentBreakPage <= 1;
    if (brkNextBtn) brkNextBtn.disabled = currentBreakPage >= totalPages;
  }

  // Initial load
  if (!token) {
    showLoginOverlay();
  } else {
    loadDepartments();
    loadDashboard();
  }
})();
