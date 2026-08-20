import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHrApiClient, getAuthHeader } from '../src/lib/api';

describe('HR Dashboard API Client Unit Tests (W-601)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats Bearer token header correctly', () => {
    const headers = getAuthHeader('hr_token_99');
    expect(headers).toEqual({ Authorization: 'Bearer hr_token_99' });
  });

  it('returns empty headers when token is null', () => {
    const headers = getAuthHeader(null);
    expect(headers).toEqual({});
  });

  it('sends GET request to backend API with Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'emp-1', full_name: 'Jane Doe' }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const api = createHrApiClient('http://localhost:4000', 'valid_token');
    const res = await api.get('/api/employees');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/employees', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_token',
      },
    });
    expect(res).toEqual([{ id: 'emp-1', full_name: 'Jane Doe' }]);
  });

  it('throws Error when HTTP request fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const api = createHrApiClient('http://localhost:4000', 'bad_token');
    await expect(api.get('/api/employees')).rejects.toThrow('Forbidden');
  });
});
