import { guardRoute } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/toast';

interface RolePermissions {
  key?: string;
  role_key?: string;
  name?: string;
  role_name?: string;
  permissions: string[];
}

interface PermissionTaxonomyItem {
  key: string;
  description: string | null;
}

export function renderPermissionsMatrixPage(container: HTMLElement): void {
  if (!guardRoute('portal.permissions', container)) {
    return;
  }

  container.innerHTML = `
    <div class="main-content">
      <div class="section-header">
        <h2>Permissions Management Matrix</h2>
        <button id="savePermissionsBtn" class="btn btn-primary">Save Changes</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr id="matrixHeaderRow">
              <th>Permission Key</th>
              <th>Description</th>
              <th>Super Admin</th>
              <th>Admin</th>
              <th>HR</th>
              <th>Manager</th>
              <th>Team Leader</th>
              <th>Employee</th>
            </tr>
          </thead>
          <tbody id="permissionsMatrixBody">
            <tr><td colspan="8" style="text-align:center;">Loading permissions matrix...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  initPermissionsMatrixLogic(container);
}

function initPermissionsMatrixLogic(container: HTMLElement): void {
  const tbody = container.querySelector('#permissionsMatrixBody') as HTMLTableSectionElement;
  const saveBtn = container.querySelector('#savePermissionsBtn') as HTMLButtonElement;

  const roleKeys = ['super_admin', 'admin', 'hr', 'manager', 'team_leader', 'employee'];
  const state: Map<string, Set<string>> = new Map();

  async function loadMatrix() {
    try {
      const [permList, roleList] = await Promise.all([
        apiFetch<PermissionTaxonomyItem[]>('/permissions'),
        apiFetch<RolePermissions[]>('/roles'),
      ]);

      roleList.forEach((r) => {
        const rk = r.key || r.role_key;
        if (rk) {
          state.set(rk, new Set(r.permissions));
        }
      });

      tbody.innerHTML = permList.map((p) => {
        const cells = roleKeys.map((rk) => {
          const isSuper = rk === 'super_admin';
          const isChecked = isSuper || (state.get(rk)?.has(p.key) ?? false);

          return `
            <td style="text-align: center;">
              <input
                type="checkbox"
                class="perm-checkbox"
                data-role="${rk}"
                data-perm="${p.key}"
                ${isChecked ? 'checked' : ''}
                ${isSuper ? 'disabled' : ''}
              />
            </td>
          `;
        }).join('');

        return `
          <tr>
            <td><code>${p.key}</code></td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${p.description || ''}</td>
            ${cells}
          </tr>
        `;
      }).join('');

      // Add event listeners to checkboxes
      tbody.querySelectorAll('.perm-checkbox').forEach((cb) => {
        cb.addEventListener('change', (e) => {
          const target = e.target as HTMLInputElement;
          const rk = target.dataset.role!;
          const pk = target.dataset.perm!;

          if (target.checked) {
            if (!state.has(rk)) state.set(rk, new Set());
            state.get(rk)?.add(pk);
          } else {
            state.get(rk)?.delete(pk);
          }
        });
      });
    } catch {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--accent-red);">Failed to load permissions matrix.</td></tr>';
    }
  }

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      for (const rk of roleKeys) {
        if (rk === 'super_admin') continue;
        const permsArray = Array.from(state.get(rk) || []);
        await apiFetch(`/roles/${rk}/permissions`, {
          method: 'PUT',
          body: JSON.stringify({ permissions: permsArray }),
        });
      }
      showToast('Permissions matrix saved successfully', 'success');
    } catch (err) {
      showToast((err as Error).message, 'danger');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  };

  loadMatrix();
}
