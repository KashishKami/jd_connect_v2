import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postDailyAttendancePrompt } from '../src/poster';

describe('Zulip Bot Poster Integration Tests (W-504)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts message to Zulip attendance stream successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', id: 99 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await postDailyAttendancePrompt({
      baseUrl: 'http://127.0.0.1:9991',
      botEmail: 'bot@company.com',
      botApiKey: 'key123',
      streamName: 'attendance',
      clockAppUrl: 'https://clock.company.com',
    });

    expect(res).toEqual({ success: true, messageId: 99 });
    expect(mockFetch).toHaveBeenCalledOnce();

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('http://127.0.0.1:9991/api/v1/messages');
  });

  it('handles Zulip API errors gracefully and returns failure object', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ result: 'error', msg: 'Stream does not exist' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await postDailyAttendancePrompt({
      baseUrl: 'http://127.0.0.1:9991',
      botEmail: 'bot@company.com',
      botApiKey: 'key123',
      streamName: 'nonexistent',
      clockAppUrl: 'https://clock.company.com',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Stream does not exist');
  });
});
