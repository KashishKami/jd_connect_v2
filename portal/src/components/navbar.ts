import { hasPermission, clearAuthToken } from '../lib/auth';
import { navigate } from '../lib/router';

export function renderNavbar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'navbar';

  const brand = document.createElement('a');
  brand.className = 'navbar-brand';
  brand.href = '/';
  brand.textContent = 'JD Connect';
  brand.onclick = (e) => {
    e.preventDefault();
    navigate('/');
  };

  const linkList = document.createElement('ul');
  linkList.className = 'navbar-links';

  const hasAudit = hasPermission('portal.attendance_audit');

  const navItems = [
    { show: !hasAudit && hasPermission('portal.attendance'), label: 'Attendance Console', path: '/' },
    { show: hasAudit, label: 'Dashboard', path: '/' },
    { show: hasPermission('portal.employees'), label: 'Employees', path: '/employees' },
    { show: hasPermission('portal.attendance_audit'), label: 'Attendance Audit', path: '/attendance-audit' },
    { show: hasPermission('portal.breaks_audit'), label: 'Breaks Audit', path: '/breaks-audit' },
    { show: hasPermission('portal.permissions'), label: 'Permissions Matrix', path: '/permissions' },
  ];

  const currentPath = window.location.pathname;

  navItems.forEach((item) => {
    if (item.show) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = `navbar-link ${currentPath === item.path ? 'active' : ''}`;
      a.href = item.path;
      a.textContent = item.label;
      a.onclick = (e) => {
        e.preventDefault();
        navigate(item.path);
      };
      li.appendChild(a);
      linkList.appendChild(li);
    }
  });

  const userControls = document.createElement('div');
  userControls.className = 'navbar-user';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-secondary';
  logoutBtn.textContent = 'Logout';
  logoutBtn.onclick = () => {
    clearAuthToken();
    navigate('/login');
  };

  userControls.appendChild(logoutBtn);

  nav.appendChild(brand);
  nav.appendChild(linkList);
  nav.appendChild(userControls);

  return nav;
}
