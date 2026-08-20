import { renderNavbar } from './components/navbar';
import { addRoute, handleRoute, navigate } from './lib/router';
import { isAuthenticated } from './lib/auth';
import { renderLoginPage } from './pages/login';
import { renderAttendanceConsole } from './pages/attendance';

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

    renderAttendanceConsole(main);
  });

  addRoute('/employees', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.innerHTML = '<div style="padding: 2rem;"><h2>Employees Page (W-1009)</h2></div>';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);
  });

  addRoute('/attendance-audit', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.innerHTML = '<div style="padding: 2rem;"><h2>Attendance Audit Page (W-1010)</h2></div>';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);
  });

  addRoute('/breaks-audit', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.innerHTML = '<div style="padding: 2rem;"><h2>Breaks Audit Page (W-1010)</h2></div>';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);
  });

  addRoute('/permissions', () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    appContainer.innerHTML = '';
    const nav = renderNavbar();
    const main = document.createElement('main');
    main.innerHTML = '<div style="padding: 2rem;"><h2>Permissions Matrix Page (W-1012)</h2></div>';
    appContainer.appendChild(nav);
    appContainer.appendChild(main);
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
