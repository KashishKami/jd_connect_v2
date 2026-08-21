import { getAuthToken, clearAuthToken } from './auth';

declare const process: { env: { BACKEND_URL?: string } };

const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
export const API_BASE = `${backendUrl}/api`;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    if (Array.isArray(errorData.details) && errorData.details.length > 0) {
      const detailsMsg = errorData.details
        .map((d: { message?: string }) => d.message || String(d))
        .filter(Boolean)
        .join(', ');
      if (detailsMsg) {
        throw new Error(`${errorData.error || 'Validation failed'}: ${detailsMsg}`);
      }
    }
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return await response.json();
}
