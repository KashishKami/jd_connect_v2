import { renderNavbar } from './components/navbar';
import { addRoute, handleRoute, navigate } from './lib/router';
import { isAuthenticated, hasPermission } from './lib/auth';
import { renderLoginPage } from './pages/login';
import { renderAttendanceConsole } from './pages/attendance';
import { renderEmployeesPage } from './pages/employees';
import { renderAttendanceAuditPage } from './pages/attendance_audit';
import { renderBreaksAuditPage } from './pages/breaks_audit';
import { renderPermissionsMatrixPage } from './pages/permissions';
import { renderDashboardPage } from './pages/dashboard';

function initApp(): void {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  addRoute('/login', () => {
    appContainer.innerHTML = '';
    renderLoginPage(appContainer);
  });

  addRoute('/', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.id = 'mainContent';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);

    if (hasPermission('portal.attendance_audit')) {
      renderDashboardPage(main);
    } else {
      renderAttendanceConsole(main);
    }
  });

  addRoute('/employees', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.id = 'mainContent';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);

    renderEmployeesPage(main);
  });

  addRoute('/attendance-audit', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.id = 'mainContent';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);

    renderAttendanceAuditPage(main);
  });

  addRoute('/breaks-audit', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.id = 'mainContent';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);

    renderBreaksAuditPage(main);
  });

  addRoute('/permissions', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.id = 'mainContent';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);

    renderPermissionsMatrixPage(main);
  });

  addRoute('*', () => {
    navigate('/');
  });

  handleRoute();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
