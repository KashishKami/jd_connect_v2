import dotenv from 'dotenv';
import path from 'path';
import { ZulipCreateUserPayload, ZulipUserResponse } from '../types/zulip';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

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
  private customBaseUrl: string | undefined;
  private customBotEmail: string | undefined;
  private customBotApiKey: string | undefined;

  constructor(baseUrl?: string, botEmail?: string, botApiKey?: string) {
    this.customBaseUrl = baseUrl;
    this.customBotEmail = botEmail;
    this.customBotApiKey = botApiKey;
  }

  private get baseUrl(): string {
    return this.customBaseUrl || process.env.ZULIP_BASE_URL || '';
  }

  private get botEmail(): string {
    return this.customBotEmail || process.env.ZULIP_BOT_EMAIL || '';
  }

  private get botApiKey(): string {
    return this.customBotApiKey || process.env.ZULIP_BOT_API_KEY || '';
  }

  async fetchUserByEmail(email: string): Promise<{ zulipUserId: number } | null> {
    const authHeader = 'Basic ' + Buffer.from(`${this.botEmail}:${this.botApiKey}`).toString('base64');
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { Authorization: authHeader },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { result: string; user_id?: number; user?: { user_id: number } };
      const userId = data.user?.user_id ?? data.user_id;
      if (data.result === 'success' && typeof userId === 'number') {
        return { zulipUserId: userId };
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

  async getZulipUserBySessionKey(sessionKey?: string): Promise<{ email: string; zulipUserId: number } | null> {
    if (!sessionKey) return null;
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      const zulipDir = path.resolve(__dirname, '../../../docker/zulip');
      const safeKey = sessionKey.replace(/[^a-zA-Z0-9]/g, '');
      const cmd = `docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "from django.contrib.sessions.models import Session; from zerver.models import UserProfile; s = Session.objects.filter(session_key='${safeKey}').first(); data = s.get_decoded() if s else {}; uid = data.get('_auth_user_id'); u = UserProfile.objects.filter(id=int(uid)).first() if uid else None; print(f'{u.delivery_email}:{u.id}') if u else print('')"`;

      const { stdout } = await execAsync(cmd, { cwd: zulipDir });
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const [email, idStr] = lastLine.split(':');
      if (email && idStr && email.includes('@')) {
        return { email: email.trim(), zulipUserId: Number(idStr.trim()) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLatestActiveZulipUser(): Promise<{ email: string; zulipUserId: number } | null> {
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      const zulipDir = path.resolve(__dirname, '../../../docker/zulip');
      const cmd = `docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "from django.contrib.sessions.models import Session; from zerver.models import UserProfile; s = Session.objects.order_by('-expire_date').first(); data = s.get_decoded() if s else {}; uid = data.get('_auth_user_id'); u = UserProfile.objects.filter(id=int(uid)).first() if uid else None; print(f'{u.delivery_email}:{u.id}') if u else print('')"`;

      const { stdout } = await execAsync(cmd, { cwd: zulipDir });
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const [email, idStr] = lastLine.split(':');
      if (email && idStr && email.includes('@')) {
        return { email: email.trim(), zulipUserId: Number(idStr.trim()) };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const zulipService = new ZulipService();
