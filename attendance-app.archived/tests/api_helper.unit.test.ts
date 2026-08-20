import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient, getAuthHeader } from '../src/api';

describe('Attendance App API Helper (W-501 Unit)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats Bearer auth header correctly when token is present', () => {
    const header = getAuthHeader('my_test_token_123');
    expect(header).toEqual({ Authorization: 'Bearer my_test_token_123' });
  });

  it('returns empty object when token is missing', () => {
    const header = getAuthHeader(null);
    expect(header).toEqual({});
  });

  it('makes fetch request with Bearer token and returns JSON response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'present', clock_in_at: '2026-08-15T09:00:00Z' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient('http://localhost:4000', 'token_abc');
    const data = await client.get('/api/attendance');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/attendance', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token_abc',
      },
    });
    expect(data).toEqual({ status: 'present', clock_in_at: '2026-08-15T09:00:00Z' });
  });

  it('throws Error on non-ok HTTP status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient('http://localhost:4000', 'bad_token');
    await expect(client.get('/api/attendance')).rejects.toThrow('Unauthorized');
  });
});
