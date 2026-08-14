import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZulipService, ZulipProvisioningError } from '../src/services/zulip.service';

describe('ZulipService', () => {
  let zulipService: ZulipService;

  beforeEach(() => {
    vi.restoreAllMocks();
    zulipService = new ZulipService('http://127.0.0.1:9991', 'bot@company.com', 'key123');
  });

  it('creates a Zulip user successfully and returns user_id', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'success',
        msg: '',
        user_id: 42,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await zulipService.createUser({
      email: 'test@company.com',
      full_name: 'Test User',
      password: 'Password123!',
    });

    expect(res).toEqual({ zulipUserId: 42 });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws ZulipProvisioningError when Zulip API returns error result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'error',
        msg: 'Email already in use',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      zulipService.createUser({
        email: 'existing@company.com',
        full_name: 'Existing User',
        password: 'Password123!',
      })
    ).rejects.toThrow(ZulipProvisioningError);
  });
});
