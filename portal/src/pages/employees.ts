import { guardRoute, hasPermission } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';
import { createModal } from '../components/modal';

interface EmployeeRow {
  id: string;
  employee_code?: string;
  full_name: string;
  alias?: string | null;
  email: string;
  mobile?: string | null;
  role?: string | null;
  role_id?: string | null;
  role_key?: string | null;
  department?: string | null;
  department_id?: string | null;
  centre?: string | null;
  centre_name?: string | null;
  centre_id?: string | null;
  shift_name?: string | null;
  shift_id?: string | null;
  designation?: string | null;
  zulip_provisioned?: boolean;
  zulip_user_id?: number | null;
  employment_status: string;
}

interface DepartmentRow {
  id: string;
  name: string;
}

interface CentreRow {
  id: string;
  code: string;
  name: string;
}

interface ShiftRow {
  id: string;
  name: string;
}

export function renderEmployeesPage(container: HTMLElement): void {
  if (!guardRoute('portal.employees', container)) {
    return;
  }

  const canCreate = hasPermission('employees.create');
  const canEdit = hasPermission('employees.edit');
  const canFilterRole = hasPermission('employees.filter.by_role');
  const canFilterDept = hasPermission('employees.filter.by_department');
  const canFilterStatus = hasPermission('employees.filter.by_status');

  container.innerHTML = `
    <div class="main-content">
      <div class="section-header">
        <h2>Employee Management</h2>
        ${canCreate ? '<button id="addEmployeeBtn" class="btn btn-primary">+ Add Employee</button>' : ''}
      </div>

      <div class="filter-bar">
        <input type="text" id="inputSearch" class="input-search" placeholder="Search employees by name, email, code..." />
        ${canFilterRole ? `
          <select id="selectRoleFilter" class="select-filter">
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="team_leader">Team Leader</option>
            <option value="employee">Employee</option>
          </select>` : ''}
        ${canFilterDept ? `
          <select id="selectDeptFilter" class="select-filter">
            <option value="">All Departments</option>
          </select>` : ''}
        ${canFilterStatus ? `
          <select id="selectStatusFilter" class="select-filter">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
            <option value="absconded">Absconded</option>
          </select>` : ''}
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Full Name</th>
              <th>Alias</th>
              <th>Email & Phone</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Centre</th>
              <th>Role</th>
              <th>Status</th>
              <th>Zulip Provisioned</th>
              ${canEdit ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody id="employeesTableBody">
            <tr><td colspan="11" style="text-align:center;">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-bar">
        <button id="empPrev" class="btn btn-secondary" disabled>Previous</button>
        <span id="empPageInfo" class="page-indicator">Page 1</span>
        <button id="empNext" class="btn btn-secondary" disabled>Next</button>
      </div>
    </div>
  `;

  initEmployeesLogic(container, { canCreate, canEdit });
}

function initEmployeesLogic(
  container: HTMLElement,
  flags: { canCreate: boolean; canEdit: boolean }
): void {
  const tbody = container.querySelector('#employeesTableBody') as HTMLTableSectionElement;
  const searchInput = container.querySelector('#inputSearch') as HTMLInputElement;
  const roleSelect = container.querySelector('#selectRoleFilter') as HTMLSelectElement;
  const deptSelect = container.querySelector('#selectDeptFilter') as HTMLSelectElement;
  const statusSelect = container.querySelector('#selectStatusFilter') as HTMLSelectElement;

  let employeesCache: EmployeeRow[] = [];

  async function loadDepartments() {
    if (!deptSelect) return;
    try {
      const depts = await apiFetch<DepartmentRow[]>('/departments');
      depts.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
    } catch {
      // ignore
    }
  }

  async function loadEmployees() {
    try {
      const params = new URLSearchParams();
      if (searchInput?.value.trim()) params.set('search', searchInput.value.trim());
      if (roleSelect?.value) params.set('role_key', roleSelect.value);
      if (deptSelect?.value) params.set('department_id', deptSelect.value);
      if (statusSelect?.value) params.set('status', statusSelect.value);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      employeesCache = await apiFetch<EmployeeRow[]>(`/employees${queryString}`);

      if (employeesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No employees found.</td></tr>';
        return;
      }

      tbody.innerHTML = employeesCache.map((e) => {
        const code = e.employee_code || '-';
        const aliasBadge = e.alias ? `<span class="badge badge-purple">${e.alias}</span>` : '<span style="color:var(--text-muted);">-</span>';
        const isActive = e.employment_status === 'active';
        
        let zulipCell = '<span class="badge badge-success">Provisioned</span>';
        if (!e.zulip_provisioned) {
          zulipCell = `
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span class="badge badge-warning">Pending</span>
              <button class="btn btn-secondary btn-retry-zulip" data-id="${e.id}" style="padding: 2px 6px; font-size: 0.75rem;">Retry</button>
            </div>
          `;
        }

        return `
          <tr>
            <td><code>${code}</code></td>
            <td><strong>${e.full_name}</strong></td>
            <td>${aliasBadge}</td>
            <td>
              <div style="font-weight: 500;">${e.email}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${e.mobile || 'No phone'}</div>
            </td>
            <td>${e.designation || '-'}</td>
            <td>${e.department || '-'}</td>
            <td>${e.centre || e.centre_name || '-'}</td>
            <td><span class="badge badge-purple">${e.role || 'employee'}</span></td>
            <td><span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">${e.employment_status}</span></td>
            <td>${zulipCell}</td>
            ${flags.canEdit ? `<td><button class="btn btn-secondary btn-edit-emp" data-id="${e.id}">Edit</button></td>` : ''}
          </tr>
        `;
      }).join('');

      // Attach edit button listeners
      tbody.querySelectorAll('.btn-edit-emp').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          const target = ev.target as HTMLButtonElement;
          const empId = target.dataset.id;
          const emp = employeesCache.find((x) => x.id === empId);
          if (emp) {
            openEditEmployeeModal(emp, loadEmployees);
          }
        });
      });

      // Attach retry zulip listeners
      tbody.querySelectorAll('.btn-retry-zulip').forEach((btn) => {
        btn.addEventListener('click', async (ev) => {
          const target = ev.target as HTMLButtonElement;
          const empId = target.dataset.id;
          if (!empId) return;
          target.disabled = true;
          target.textContent = 'Retrying...';
          try {
            await apiFetch(`/employees/${empId}/retry-zulip-provisioning`, { method: 'POST' });
            showToast('Zulip provisioning completed successfully', 'success');
            await loadEmployees();
          } catch (err) {
            showToast((err as Error).message, 'danger');
            target.disabled = false;
            target.textContent = 'Retry';
          }
        });
      });
    } catch {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color: var(--accent-red);">Failed to load employees.</td></tr>';
    }
  }

  if (searchInput) searchInput.oninput = () => loadEmployees();
  if (roleSelect) roleSelect.onchange = () => loadEmployees();
  if (deptSelect) deptSelect.onchange = () => loadEmployees();
  if (statusSelect) statusSelect.onchange = () => loadEmployees();

  const addBtn = container.querySelector('#addEmployeeBtn');
  if (addBtn && flags.canCreate) {
    addBtn.addEventListener('click', () => {
      openAddEmployeeModal(loadEmployees);
    });
  }

  loadDepartments();
  loadEmployees();
}

async function openAddEmployeeModal(onSuccess: () => void): Promise<void> {
  const [depts, centres, shifts] = await Promise.all([
    apiFetch<DepartmentRow[]>('/departments').catch(() => []),
    apiFetch<CentreRow[]>('/centres').catch(() => []),
    apiFetch<ShiftRow[]>('/shifts').catch(() => []),
  ]);

  const form = document.createElement('form');
  form.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
      <div class="form-group">
        <label>Full Name *</label>
        <input type="text" id="addFullName" class="form-input" required />
      </div>
      <div class="form-group">
        <label>Alias</label>
        <input type="text" id="addAlias" class="form-input" placeholder="e.g. Adam" />
      </div>
      <div class="form-group">
        <label>Email Address *</label>
        <input type="email" id="addEmail" class="form-input" required />
      </div>
      <div class="form-group">
        <label>Password *</label>
        <input type="password" id="addPassword" class="form-input" required minlength="8" />
      </div>
      <div class="form-group">
        <label>Role *</label>
        <select id="addRoleKey" class="form-input" required>
          <option value="employee">Employee</option>
          <option value="team_leader">Team Leader</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>
      <div class="form-group">
        <label>Mobile Phone Number</label>
        <input type="text" id="addMobile" class="form-input" placeholder="+1-555-0199" />
      </div>
      <div class="form-group">
        <label>Designation</label>
        <input type="text" id="addDesignation" class="form-input" placeholder="e.g. Senior Agent" />
      </div>
      <div class="form-group">
        <label>Department</label>
        <select id="addDeptId" class="form-input">
          <option value="">Select Department...</option>
          ${depts.map((d) => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Centre Location</label>
        <select id="addCentreId" class="form-input">
          <option value="">Select Centre...</option>
          ${centres.map((c) => `<option value="${c.id}">${c.name} (${c.code})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Shift Assignment</label>
        <select id="addShiftId" class="form-input">
          <option value="">Select Shift...</option>
          ${shifts.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <button type="submit" class="btn btn-primary" style="width:100%; margin-top: 1.5rem;">Create Employee</button>
  `;

  const modal = createModal({
    title: 'Add New Employee',
    content: form,
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch<EmployeeRow & { zulip_provisioned?: boolean; warning?: string }>('/employees', {
        method: 'POST',
        body: JSON.stringify({
          full_name: (form.querySelector('#addFullName') as HTMLInputElement).value.trim(),
          alias: (form.querySelector('#addAlias') as HTMLInputElement).value.trim() || undefined,
          email: (form.querySelector('#addEmail') as HTMLInputElement).value.trim(),
          password: (form.querySelector('#addPassword') as HTMLInputElement).value,
          role_key: (form.querySelector('#addRoleKey') as HTMLSelectElement).value,
          mobile: (form.querySelector('#addMobile') as HTMLInputElement).value.trim() || undefined,
          designation: (form.querySelector('#addDesignation') as HTMLInputElement).value.trim() || undefined,
          department_id: (form.querySelector('#addDeptId') as HTMLSelectElement).value || undefined,
          centre_id: (form.querySelector('#addCentreId') as HTMLSelectElement).value || undefined,
          shift_id: (form.querySelector('#addShiftId') as HTMLSelectElement).value || undefined,
        }),
      });

      if (res.zulip_provisioned === false) {
        showToast(res.warning || 'Employee created, but Zulip provisioning is pending', 'warning');
      } else {
        showToast('Employee created and provisioned in Zulip successfully', 'success');
      }
      modal.remove();
      onSuccess();
    } catch (err) {
      showToast((err as Error).message, 'danger');
    }
  };
}

async function openEditEmployeeModal(emp: EmployeeRow, onSuccess: () => void): Promise<void> {
  const [depts, centres, shifts] = await Promise.all([
    apiFetch<DepartmentRow[]>('/departments').catch(() => []),
    apiFetch<CentreRow[]>('/centres').catch(() => []),
    apiFetch<ShiftRow[]>('/shifts').catch(() => []),
  ]);

  const form = document.createElement('form');
  form.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="editFullName" class="form-input" value="${emp.full_name || ''}" required />
      </div>
      <div class="form-group">
        <label>Alias</label>
        <input type="text" id="editAlias" class="form-input" value="${emp.alias || ''}" />
      </div>
      <div class="form-group">
        <label>Mobile Phone Number</label>
        <input type="text" id="editMobile" class="form-input" value="${emp.mobile || ''}" />
      </div>
      <div class="form-group">
        <label>Designation</label>
        <input type="text" id="editDesignation" class="form-input" value="${emp.designation || ''}" />
      </div>
      <div class="form-group">
        <label>Department</label>
        <select id="editDeptId" class="form-input">
          <option value="">No Department</option>
          ${depts.map((d) => `<option value="${d.id}" ${emp.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Centre Location</label>
        <select id="editCentreId" class="form-input">
          <option value="">No Centre</option>
          ${centres.map((c) => `<option value="${c.id}" ${emp.centre_id === c.id ? 'selected' : ''}>${c.name} (${c.code})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Shift Assignment</label>
        <select id="editShiftId" class="form-input">
          <option value="">No Shift</option>
          ${shifts.map((s) => `<option value="${s.id}" ${emp.shift_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Employment Status</label>
        <select id="editStatus" class="form-input">
          <option value="active" ${emp.employment_status === 'active' ? 'selected' : ''}>Active</option>
          <option value="suspended" ${emp.employment_status === 'suspended' ? 'selected' : ''}>Suspended</option>
          <option value="resigned" ${emp.employment_status === 'resigned' ? 'selected' : ''}>Resigned</option>
          <option value="terminated" ${emp.employment_status === 'terminated' ? 'selected' : ''}>Terminated</option>
          <option value="absconded" ${emp.employment_status === 'absconded' ? 'selected' : ''}>Absconded</option>
        </select>
      </div>
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>Reset Password (optional)</label>
        <input type="password" id="editNewPassword" class="form-input" placeholder="Leave blank to keep current" />
      </div>
    </div>
    <button type="submit" class="btn btn-primary" style="width:100%; margin-top: 1.5rem;">Save Changes</button>
  `;

  const modal = createModal({
    title: `Edit Employee: ${emp.full_name}`,
    content: form,
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        full_name: (form.querySelector('#editFullName') as HTMLInputElement).value.trim(),
        alias: (form.querySelector('#editAlias') as HTMLInputElement).value.trim() || undefined,
        mobile: (form.querySelector('#editMobile') as HTMLInputElement).value.trim() || undefined,
        designation: (form.querySelector('#editDesignation') as HTMLInputElement).value.trim() || undefined,
        department_id: (form.querySelector('#editDeptId') as HTMLSelectElement).value || null,
        centre_id: (form.querySelector('#editCentreId') as HTMLSelectElement).value || null,
        shift_id: (form.querySelector('#editShiftId') as HTMLSelectElement).value || null,
        employment_status: (form.querySelector('#editStatus') as HTMLSelectElement).value,
      };

      const newPass = (form.querySelector('#editNewPassword') as HTMLInputElement).value;
      if (newPass) {
        payload.new_password = newPass;
      }

      await apiFetch(`/employees/${emp.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      showToast('Employee updated successfully', 'success');
      modal.remove();
      onSuccess();
    } catch (err) {
      showToast((err as Error).message, 'danger');
    }
  };
}
