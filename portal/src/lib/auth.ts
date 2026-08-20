const TOKEN_KEY = 'jd_connect_token';
const PERMS_KEY = 'jd_connect_permissions';

const inMemoryStore: Record<string, string> = {};

function getItem(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return inMemoryStore[key] || null;
}

function setItem(key: string, val: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, val);
  } else {
    inMemoryStore[key] = val;
  }
}

function removeItem(key: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  } else {
    delete inMemoryStore[key];
  }
}

export function getAuthToken(): string | null {
  return getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  removeItem(TOKEN_KEY);
  removeItem(PERMS_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function getUserPermissions(): string[] {
  const raw = getItem(PERMS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function setUserPermissions(permissions: string[]): void {
  setItem(PERMS_KEY, JSON.stringify(permissions));
}

export function hasPermission(key: string): boolean {
  const perms = getUserPermissions();
  return perms.includes(key);
}

export function logout(): void {
  clearAuthToken();
}

declare const process: { env: { BACKEND_URL?: string } };

export async function login(email: string, password: string): Promise<string[]> {
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
  const baseUrl = `${backendUrl}/api`;

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(data.error || 'Invalid credentials');
  }

  const data = await res.json();
  const token = data.access_token || data.token;
  if (token) {
    setAuthToken(token);
  }

  // Fetch permissions for caller
  const permRes = await fetch(`${baseUrl}/me/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let perms: string[] = [];
  if (permRes.ok) {
    const permData = await permRes.json();
    perms = permData.permissions || [];
  }

  setUserPermissions(perms);
  return perms;
}

export function guardRoute(requiredKey: string, container: HTMLElement): boolean {
  if (!isAuthenticated()) {
    return false;
  }

  if (!hasPermission(requiredKey)) {
    container.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: var(--danger);">
        <h2>Access Denied</h2>
        <p style="margin-top: 0.5rem; color: var(--text-muted);">You do not have permission (${requiredKey}) to access this page.</p>
      </div>
    `;
    return false;
  }

  return true;
}
