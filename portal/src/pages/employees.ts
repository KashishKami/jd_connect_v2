import { guardRoute, hasPermission } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';
import { createModal } from '../components/modal';

interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  mobile_number?: string;
  designation?: string;
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
  const canViewSensitive = hasPermission('employees.view.sensitive');

  container.innerHTML = `
    <div class="main-content">
      <div class="section-header">
        <h2>Employee Management</h2>
        ${canCreate ? '<button id="addEmployeeBtn" class="btn btn-primary">+ Add Employee</button>' : ''}
      </div>

      <div class="filter-bar">
        <input type="text" id="inputSearch" class="input-search" placeholder="Search employees by name, email..." />
        ${canFilterRole ? `
          <select id="selectRoleFilter" class="select-filter">
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="team_lead">Team Lead</option>
            <option value="employee">Employee</option>
          </select>` : ''}
        ${canFilterDept ? `
          <select id="selectDeptFilter" class="select-filter">
            <option value="">All Departments</option>
            <option value="Operations">Operations</option>
            <option value="Support">Support</option>
            <option value="HR">HR</option>
          </select>` : ''}
        ${canFilterStatus ? `
          <select id="selectStatusFilter" class="select-filter">
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>` : ''}
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              ${canViewSensitive ? '<th>Mobile</th><th>Designation</th>' : ''}
              <th>Status</th>
              ${canEdit ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody id="employeesTableBody">
            <tr><td colspan="7" style="text-align:center;">Loading...</td></tr>
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

  initEmployeesLogic(container, { canCreate, canEdit, canViewSensitive });
}

function initEmployeesLogic(
  container: HTMLElement,
  flags: { canCreate: boolean; canEdit: boolean; canViewSensitive: boolean }
): void {
  const tbody = container.querySelector('#employeesTableBody') as HTMLTableSectionElement;
  const searchInput = container.querySelector('#inputSearch') as HTMLInputElement;

  async function loadEmployees() {
    try {
      const employees = await apiFetch<EmployeeRow[]>('/employees');
      const query = searchInput?.value.toLowerCase() || '';

      const filtered = employees.filter((e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(query) ||
        e.email.toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No employees found.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map((e) => `
        <tr>
          <td><strong>${e.first_name} ${e.last_name}</strong></td>
          <td>${e.email}</td>
          <td><span class="badge badge-purple">${e.role}</span></td>
          ${flags.canViewSensitive ? `<td>${e.mobile_number || '-'}</td><td>${e.designation || '-'}</td>` : ''}
          <td><span class="badge ${e.is_active ? 'badge-success' : 'badge-danger'}">${e.is_active ? 'Active' : 'Inactive'}</span></td>
          ${flags.canEdit ? `<td><button class="btn btn-secondary btn-edit-emp" data-id="${e.id}">Edit</button></td>` : ''}
        </tr>
      `).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--accent-red);">Failed to load employees.</td></tr>';
    }
  }

  if (searchInput) {
    searchInput.oninput = () => loadEmployees();
  }

  const addBtn = container.querySelector('#addEmployeeBtn');
  if (addBtn && flags.canCreate) {
    addBtn.addEventListener('click', () => {
      openAddEmployeeModal(loadEmployees);
    });
  }

  loadEmployees();
}

function openAddEmployeeModal(onSuccess: () => void): void {
  const form = document.createElement('form');
  form.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <label style="display:block; margin-bottom: 0.5rem;">First Name</label>
      <input type="text" id="addFirstName" class="input-search" style="width:100%;" required />
    </div>
    <div style="margin-bottom: 1rem;">
      <label style="display:block; margin-bottom: 0.5rem;">Last Name</label>
      <input type="text" id="addLastName" class="input-search" style="width:100%;" required />
    </div>
    <div style="margin-bottom: 1rem;">
      <label style="display:block; margin-bottom: 0.5rem;">Email</label>
      <input type="email" id="addEmail" class="input-search" style="width:100%;" required />
    </div>
    <div style="margin-bottom: 1.5rem;">
      <label style="display:block; margin-bottom: 0.5rem;">Role</label>
      <select id="addRole" class="select-filter" style="width:100%;" required>
        <option value="employee">Employee</option>
        <option value="team_lead">Team Lead</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <button type="submit" class="btn btn-primary" style="width:100%;">Create Employee</button>
  `;

  const modal = createModal({
    title: 'Add New Employee',
    content: form,
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify({
          first_name: (form.querySelector('#addFirstName') as HTMLInputElement).value,
          last_name: (form.querySelector('#addLastName') as HTMLInputElement).value,
          email: (form.querySelector('#addEmail') as HTMLInputElement).value,
          role: (form.querySelector('#addRole') as HTMLSelectElement).value,
        }),
      });
      showToast('Employee created successfully', 'success');
      modal.remove();
      onSuccess();
    } catch (err) {
      showToast((err as Error).message, 'danger');
    }
  };
}
