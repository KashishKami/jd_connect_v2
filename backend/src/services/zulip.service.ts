import { ZulipCreateUserPayload, ZulipUserResponse } from '../types/zulip';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export class ZulipProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZulipProvisioningError';
  }
}

export class ZulipService {
  constructor(
    private baseUrl: string = process.env.ZULIP_BASE_URL || 'https://127.0.0.1:9991',
    private botEmail: string = process.env.ZULIP_BOT_EMAIL || 'jdconnect-bot@company.com',
    private botApiKey: string = process.env.ZULIP_BOT_API_KEY || 'G8e43VrvWU1x5Llk2Amjtqm3u6FXH7xI'
  ) {}

  async fetchUserByEmail(email: string): Promise<{ zulipUserId: number } | null> {
    const authHeader = 'Basic ' + Buffer.from(`${this.botEmail}:${this.botApiKey}`).toString('base64');
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { Authorization: authHeader },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { result: string; user_id?: number };
      if (data.result === 'success' && typeof data.user_id === 'number') {
        return { zulipUserId: data.user_id };
      }
      return null;
    } catch {
      return null;
    }
  }

  async createUser(payload: ZulipCreateUserPayload): Promise<{ zulipUserId: number }> {
    const authHeader = 'Basic ' + Buffer.from(`${this.botEmail}:${this.botApiKey}`).toString('base64');

    const params = new URLSearchParams();
    params.append('email', payload.email);
    params.append('full_name', payload.full_name);
    params.append('password', payload.password);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        // Try fetching existing user ID if already created
        const existing = await this.fetchUserByEmail(payload.email);
        if (existing) return existing;
        throw new ZulipProvisioningError(`Zulip API HTTP status ${response.status}`);
      }

      const data = (await response.json()) as ZulipUserResponse;
      if (data.result !== 'success' || typeof data.user_id !== 'number') {
        const existing = await this.fetchUserByEmail(payload.email);
        if (existing) return existing;
        throw new ZulipProvisioningError(data.msg || 'Failed to create Zulip user');
      }

      return { zulipUserId: data.user_id };
    } catch (err) {
      if (err instanceof ZulipProvisioningError) {
        throw err;
      }
      const existing = await this.fetchUserByEmail(payload.email);
      if (existing) return existing;
      throw new ZulipProvisioningError(`Zulip API request failed: ${(err as Error).message}`);
    }
  }
}

export const zulipService = new ZulipService();
